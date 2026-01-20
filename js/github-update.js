const user = 'rospopa';
const repo = 'rospopa.github.io';
const branch = 'master'; 

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

    // Update the HTML elements
    const timeElement = document.getElementById('repo-update-time');
    const msgElement = document.getElementById('repo-commit-msg');

    if (timeElement) timeElement.innerText = localDate;
    if (msgElement) msgElement.innerText = commitMessage;
  })
  .catch(error => {
    console.error('Error details:', error);
    const timeElement = document.getElementById('repo-update-time');
    const msgElement = document.getElementById('repo-commit-msg');

    if (timeElement) timeElement.innerText = "Unable to fetch info";
    if (msgElement) msgElement.innerText = "Check Console for error";
  });
