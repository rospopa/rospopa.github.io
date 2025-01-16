const owner = rospopa;  // Replace with your GitHub username
const repo = rospopa.github.io;   // Replace with your GitHub repository name
const filePaths = [
  'readingList.html',
  'RSS.html',
  'space.html'  // Add more file paths as needed
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
    })
    .catch(error => console.error('Error fetching commit data for ' + filePath, error));
});
