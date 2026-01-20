const user = 'rospopa';
  const repo = 'rospopa.github.io';
  const branch = 'main'; // explicitly using the branch you linked

  fetch(`https://api.github.com/repos/${user}/${repo}/commits/${branch}`)
    .then(response => response.json())
    .then(data => {
      // 1. Get the commit message
      const commitMessage = data.commit.message;

      // 2. Get the date and format it for the user's locale and time zone
      const dateString = data.commit.committer.date;
      const dateDate = new Date(dateString);
      
      // Formatting options: generic 'medium' length with the time zone name
      const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit', 
        timeZoneName: 'short' // e.g., "EST" or "GMT+1"
      };

      // Create the localized string (uses visitor's device settings automatically)
      const localDate = dateDate.toLocaleString(undefined, options);

      // 3. Update the HTML variables
      document.getElementById('repo-update-time').innerText = localDate;
      document.getElementById('repo-commit-msg').innerText = commitMessage;
    })
    .catch(error => {
      console.error('Error fetching repo data:', error);
      document.getElementById('repo-update-time').innerText = "Unable to fetch info";
      document.getElementById('repo-commit-msg').innerText = "Unable to fetch info";
    });
