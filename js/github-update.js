const user = 'rospopa';
const repo = 'rospopa.github.io';
const branch = 'master'; 

// Fetch the latest commit details
fetch(`https://api.github.com/repos/${user}/${repo}/commits/${branch}`)
  .then(response => response.json())
  .then(data => {
    const dateDate = new Date(data.commit.committer.date);
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
  })
  .catch(error => console.error('Error fetching date:', error));

// Fetch the total number of commits
// This uses a trick: setting per_page=1 tells us how many pages (commits) there are in the header
fetch(`https://api.github.com/repos/${user}/${repo}/commits?per_page=1&sha=${branch}`)
  .then(response => {
    // The "Link" header contains the count of the last page
    const linkHeader = response.headers.get('Link');
    if (linkHeader) {
      const match = linkHeader.match(/page=(\d+)>; rel="last"/);
      if (match) {
        document.getElementById('repo-commit-msg').innerText = `${match[1]}`;
      }
    } else {
      // If there's only 1 commit, there is no link header
      document.getElementById('repo-commit-msg').innerText = `Commit #1`;
    }
  })
  .catch(error => {
    console.error('Error fetching commit count:', error);
    document.getElementById('repo-commit-msg').innerText = "Unable to count commits";
  });
