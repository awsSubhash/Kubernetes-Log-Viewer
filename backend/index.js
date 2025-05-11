const express = require("express");
const k8s = require("@kubernetes/client-node");
const cors = require("cors");
const path = require("path");

const app = express();
const port = 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, "../frontend")));

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

app.get("/logs", async (req, res) => {
  try {
    const search = req.query.search || "";
    const appName = req.query.app || "";

    const pods = await k8sApi.listPodForAllNamespaces();
    const logPromises = [];

    for (const pod of pods.body.items) {
      const namespace = pod.metadata.namespace;
      const podName = pod.metadata.name;

      if (appName && !podName.includes(appName)) continue;

      for (const container of pod.spec.containers) {
        logPromises.push(
          k8sApi
            .readNamespacedPodLog(podName, namespace, container.name)
            .then((log) => ({
              pod: podName,
              namespace,
              container: container.name,
              log: log.body,
            }))
            .catch(() => null)
        );
      }
    }

    const logs = (await Promise.all(logPromises)).filter(Boolean);
    const filteredLogs = logs.map((entry) => {
      const lines = entry.log.split("\n").map(line => {
        let logClass = 'log-default';
        const lowerLine = line.toLowerCase();
        
        if (lowerLine.includes('error') || lowerLine.includes('exception')) {
          logClass = 'log-error';
        } else if (lowerLine.includes('warn') || lowerLine.includes('warning')) {
          logClass = 'log-warning';
        } else if (lowerLine.includes('info') || lowerLine.includes('debug')) {
          logClass = 'log-info';
        }

        return { text: line, class: logClass };
      }).filter(lineObj => 
        search ? lineObj.text.toLowerCase().includes(search.toLowerCase()) : true
      );

      return { 
        ...entry, 
        log: lines,
        hasErrors: lines.some(line => line.class === 'log-error')
      };
    });

    res.json(filteredLogs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch logs" });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
