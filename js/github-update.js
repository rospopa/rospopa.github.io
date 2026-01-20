const user = 'rospopa';
const repo = 'rospopa.github.io';
// Try 'main' first. If your repo still uses 'master', change this back to 'master'.
const branch = 'main'; 

fetch(`https://api.github.com/repos/${user}/${repo}/commits/${branch}`)
  .then(response => {
    if (!response.ok) {
      throw new Error(`GitHub API Error: ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    const commitMessage = data.commit.message;
    const dateString = data.commit.committer.date;
    const dateDate = new Date(dateString);
    
    const options = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit', 
      timeZoneName: 'short' 
    };

    const localDate = dateDate.toLocaleString(undefined, options);

    document.getElementById('repo-update-time').innerText = localDate;
    document.getElementById('repo-commit-msg').innerText = commitMessage;
  })
  .catch(error => {
    console.error('Error details:', error);
    document.getElementById('repo-update-time').innerText = "Unable to fetch info";
    document.getElementById('repo-commit-msg').innerText = "Check Console for error";
  });
