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
    const { app: appName, search, start, end } = req.query;
    const startDate = start ? new Date(start) : null;
    const endDate = end ? new Date(end) : null;

    const pods = await k8sApi.listPodForAllNamespaces();
    const logPromises = [];

    for (const pod of pods.body.items) {
      const namespace = pod.metadata.namespace;
      const podName = pod.metadata.name;

      if (appName && !podName.includes(appName)) continue;

      for (const container of pod.spec.containers) {
        logPromises.push(
          k8sApi.readNamespacedPodLog(podName, namespace, container.name)
            .then((log) => ({
              pod: podName,
              namespace,
              container: container.name,
              log: log.body,
            }))
            .catch((err) => {
              console.error(`Failed to fetch logs for pod ${podName}, container ${container.name}:`, err);
              return null;
            })
        );
      }
    }

    const logs = (await Promise.all(logPromises)).filter(Boolean);
    const filteredLogs = logs.map((entry) => {
      // Check if entry.log is a string before splitting
      if (typeof entry.log !== 'string') {
        console.warn(`Non-string log for pod ${entry.pod}, container ${entry.container}:`, entry.log);
        return {
          ...entry,
          log: [],
          hasErrors: false,
        };
      }

      // Split logs only if non-empty
      const lines = entry.log.trim().length > 0 ? entry.log.split("\n") : [];

      const processedLines = lines.map((line) => {
        // Extract timestamp (ISO 8601 format)
        const isoRegex = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d+Z)\s+(.*)/;
        const match = line.match(isoRegex);
        let timestamp = null;
        let text = line;

        if (match) {
          timestamp = new Date(match[1]);
          text = match[2];
        }

        // Detect log level
        let logClass = 'log-default';
        const lowerText = text.toLowerCase();

        if (lowerText.includes('error') || lowerText.includes('exception')) {
          logClass = 'log-error';
        } else if (lowerText.includes('warn') || lowerText.includes('warning')) {
          logClass = 'log-warning';
        } else if (lowerText.includes('info') || lowerText.includes('debug')) {
          logClass = 'log-info';
        }

        return {
          text,
          class: logClass,
          timestamp: timestamp ? timestamp.toISOString() : null,
        };
      }).filter((lineObj) => {
        // Apply filters
        const lineTime = lineObj.timestamp ? new Date(lineObj.timestamp) : null;
        const timeValid = (!startDate || (lineTime && lineTime >= startDate)) &&
                         (!endDate || (lineTime && lineTime <= endDate));
        const textValid = !search || lineObj.text.toLowerCase().includes(search.toLowerCase());

        return timeValid && textValid;
      });

      return {
        ...entry,
        log: processedLines,
        hasErrors: processedLines.some((line) => line.class === 'log-error'),
      };
    }).filter((entry) => entry.log.length > 0);

    res.json(filteredLogs);
  } catch (err) {
    console.error('Error fetching logs:', err);
    res.status(500).json({ error: "Failed to fetch logs" });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
