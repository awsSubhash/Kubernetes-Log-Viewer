async function fetchLogs() {
  const app = document.getElementById('appName').value;
  const search = document.getElementById('search').value;
  const startTime = document.getElementById('startTime').value;
  const endTime = document.getElementById('endTime').value;
  const logsDiv = document.getElementById('logs');
  const loading = document.getElementById('loading');
  const errorDiv = document.getElementById('error');
  const button = document.getElementById('searchButton');
  const spinner = button.querySelector('.spinner');

  // Reset state
  logsDiv.innerHTML = '';
  errorDiv.classList.add('hidden');
  button.disabled = true;
  spinner.classList.remove('hidden');
  loading.classList.remove('hidden');

  try {
    const params = new URLSearchParams({
      app,
      search,
      start: startTime ? new Date(startTime).toISOString() : '',
      end: endTime ? new Date(endTime).toISOString() : ''
    });

    const res = await fetch(`/logs?${params}`);
    
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    
    const data = await res.json();
    
    if (data.error) throw new Error(data.error);
    if (data.length === 0) {
      logsDiv.innerHTML = '<div class="alert">No logs found matching your criteria</div>';
      return;
    }

    data.forEach((entry) => {
      const logEntry = document.createElement('div');
      logEntry.className = `log-entry ${entry.hasErrors ? 'has-errors' : ''}`;
      
      const logContent = entry.log.map(line => {
        const timestamp = line.timestamp ? 
          `<span class="log-timestamp">[${new Date(line.timestamp).toLocaleString()}]</span>` : 
          '';
        return `${timestamp}<span class="${line.class}">${line.text}</span>`;
      }).join('\n');

      logEntry.innerHTML = `
        <h3>
          <span class="namespace">${entry.namespace}</span> /
          <span class="pod">${entry.pod}</span> /
          <span class="container">${entry.container}</span>
        </h3>
        <pre>${logContent || "No logs available for this container"}</pre>
      `;
      logsDiv.appendChild(logEntry);
    });

  } catch (err) {
    errorDiv.textContent = `Error: ${err.message}`;
    errorDiv.classList.remove('hidden');
    console.error('Error fetching logs:', err);
  } finally {
    button.disabled = false;
    spinner.classList.add('hidden');
    loading.classList.add('hidden');
  }
}

document.getElementById('search').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') fetchLogs();
});
