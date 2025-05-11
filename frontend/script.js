async function fetchLogs() {
  const app = document.getElementById('appName').value;
  const search = document.getElementById('search').value;
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
    const res = await fetch(`/logs?app=${app}&search=${search}`);
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();

    if (data.error) {
      throw new Error(data.error);
    }

    if (data.length === 0) {
      logsDiv.innerHTML = '<div class="alert">No logs found matching your criteria</div>';
      return;
    }

    data.forEach((entry) => {
      const logEntry = document.createElement('div');
      logEntry.className = `log-entry ${entry.hasErrors ? 'has-errors' : ''}`;
      
      const logContent = entry.log.map(line => 
        `<span class="${line.class}">${line.text}</span>`
      ).join('\n');

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

// Add enter key support
document.getElementById('search').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') fetchLogs();
});
