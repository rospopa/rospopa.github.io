const user = 'rospopa';
const repo = 'rospopa.github.io';
const branch = 'master'; 

// 1. Determine the current file path
// If on the root, default to 'index.html', otherwise strip the leading slash
let filePath = window.location.pathname.substring(1);
if (filePath === "" || filePath.endsWith("/")) {
  filePath += "index.html";
}

// Update the API URLs to include the path parameter
const commitInfoUrl = `https://api.github.com/repos/${user}/${repo}/commits?path=${filePath}&sha=${branch}&per_page=1`;

/**
 * Fetches both the latest date and total count for the specific file
 */
async function fetchPageStats() {
  try {
    const response = await fetch(commitInfoUrl);
    
    if (!response.ok) throw new Error("File not found in repository");

    const data = await response.json();

    if (data.length > 0) {
      // Latest Commit Date for this specific file
      const dateDate = new Date(data[0].commit.committer.date);
      const options = { 
        year: 'numeric', month: 'long', day: 'numeric', 
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short' 
      };
      document.getElementById('repo-update-time').innerText = dateDate.toLocaleString(undefined, options);

      // Total Commits for this specific file
      const linkHeader = response.headers.get('Link');
      if (linkHeader) {
        const match = linkHeader.match(/page=(\d+)>; rel="last"/);
        document.getElementById('repo-commit-msg').innerText = match ? match[1] : "1";
      } else {
        document.getElementById('repo-commit-msg').innerText = "1";
      }
    } else {
      document.getElementById('repo-update-time').innerText = "Unknown";
      document.getElementById('repo-commit-msg').innerText = "0";
    }
  } catch (error) {
    console.error('Error fetching page stats:', error);
    document.getElementById('repo-update-time').innerText = "Error loading data";
    document.getElementById('repo-commit-msg').innerText = "N/A";
  }
}

fetchPageStats();
