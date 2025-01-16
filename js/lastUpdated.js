document.addEventListener('DOMContentLoaded', () => {
  const owner = 'rospopa';  // Your GitHub username
  const repo = 'rospopa.github.io';   // Your GitHub repository name
  const filePaths = [
    'RSS.html',
    'readingList.html'
  ];

  // Loop through each file path to fetch commit data and update the corresponding dates
  filePaths.forEach(filePath => {
    fetch(`https://api.github.com/repos/${owner}/${repo}/commits?path=${filePath}`)
      .then(response => response.json())
      .then(commits => {
        // Check if commits exist to avoid errors
        if (commits.length > 0) {
          const lastCommitDate = commits[0].commit.author.date;
          const date = new Date(lastCommitDate);
          
          // Validate if the date is valid
          if (!isNaN(date)) {
            const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
            const formattedDate = date.toLocaleDateString('en-US', options);
            
            // Update the date in the corresponding <span> based on the file
            if (filePath === 'RSS.html') {
              document.getElementById('RSS-date').textContent = `Updated ${formattedDate}`;
            } else if (filePath === 'readingList.html') {
              document.getElementById('readingList-date').textContent = `Updated ${formattedDate}`;
            } else if (filePath === 'economicCalendar.html') {
              document.getElementById('economicCalendar-date').textContent = `Updated ${formattedDate}`;
          } else {
            console.error(`Invalid date for commit on ${filePath}`);
          }
        } else {
          console.error(`No commits found for ${filePath}`);
        }
      })
      .catch(error => console.error('Error fetching commit data for ' + filePath, error));
  });
});


