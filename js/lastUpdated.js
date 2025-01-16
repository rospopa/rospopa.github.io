document.addEventListener('DOMContentLoaded', () => {
  const owner = 'rospopa';  // Your GitHub username
  const repo = 'rospopa.github.io';   // Your GitHub repository name
  const filePaths = [
    'readingList.html',
    'RSS.html',
    'space.html',   // Add more file paths as needed
    'js/lastUpdated.js'  // Track the specific file you want to update
  ];

  const updateList = document.getElementById('update-list');  // This is the <ul> element

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
            
            // Update the list with the file and its last update date
            const listItem = document.createElement('li');
            listItem.innerHTML = `<strong>${filePath}</strong>: Updated ${formattedDate}`;
            updateList.appendChild(listItem);

            // If the file is 'js/lastUpdated.js', also update the specific span with id='file2-date'
            if (filePath === 'js/lastUpdated.js') {
              const dateElement = document.getElementById('file2-date');
              if (dateElement) {
                dateElement.textContent = `Updated ${formattedDate}`;  // Set the updated date text
              }
            }
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

