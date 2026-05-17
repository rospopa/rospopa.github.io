document.addEventListener("DOMContentLoaded", function() {
    const user = 'rospopa';
    const repo = 'rospopa.github.io';
    
    // NOTE: Change this to 'master' if your repo actually uses master instead of main.
    const branch = 'main'; 

    // 1. Determine the current file path
    let filePath = window.location.pathname.substring(1);
    if (filePath === "" || filePath.endsWith("/")) {
      filePath += "index.html";
    }

    // Update the API URL to include the path parameter
    const commitInfoUrl = `https://api.github.com/repos/${user}/${repo}/commits?path=${filePath}&sha=${branch}&per_page=1`;

    /**
     * Fetches the latest date and commit message for the specific file
     */
    async function fetchPageStats() {
      try {
        const response = await fetch(commitInfoUrl);
        
        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.length > 0) {
          // Latest Commit Date for this specific file
          const dateDate = new Date(data[0].commit.committer.date);
          const options = { 
            year: 'numeric', month: 'long', day: 'numeric', 
            hour: '2-digit', minute: '2-digit', timeZoneName: 'short' 
          };
          document.getElementById('repo-update-time').innerText = dateDate.toLocaleString(undefined, options);

          // Get the actual commit message instead of the commit count
          const commitMessage = data[0].commit.message;
          document.getElementById('repo-commit-msg').innerText = commitMessage;
          
        } else {
          // If data is empty, it means the file path doesn't match anything in the Git repo
          document.getElementById('repo-update-time').innerText = "Unknown (File not tracked)";
          document.getElementById('repo-commit-msg').innerText = "N/A";
        }
      } catch (error) {
        console.error('Error fetching page stats:', error);
        document.getElementById('repo-update-time').innerText = "Error loading data";
        document.getElementById('repo-commit-msg').innerText = "N/A";
      }
    }

    fetchPageStats();
});
