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
        const lastCommitDate = commits[0].commit.author.date;
        const date = new Date(lastCommitDate);
        const options = { year: 'numeric', month: 'long' };
        const formattedDate = date.toLocaleDateString('en-US', options);
        
        // Create a list item for each file and display its last updated date
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
      })
      .catch(error => console.error('Error fetching commit data for ' + filePath, error));
  });
});
