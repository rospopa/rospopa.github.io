const user = 'rospopa';
const repo = 'rospopa.github.io';
const branch = 'master'; 

fetch(`https://api.github.com/repos/${user}/${repo}/commits/${branch}`)
  .then(response => {
    if (!response.ok) throw new Error('Network response was not ok');
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
    console.error('Error:', error);
    document.getElementById('repo-update-time').innerText = "Error loading data";
    document.getElementById('repo-commit-msg').innerText = "Error loading data";
  });
