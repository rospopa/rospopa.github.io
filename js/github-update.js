document.addEventListener("DOMContentLoaded", function () {
    const USER = 'rospopa';
    const REPO = 'rospopa.github.io';
    const BRANCHES = ['main', 'master', 'gh-pages']; // tried in order

    const timeEl = document.getElementById('repo-update-time');
    const msgEl  = document.getElementById('repo-commit-msg');

    // 1. Build candidate file paths (handles clean URLs, trailing slash, case)
    function candidatePaths() {
        let p = decodeURIComponent(window.location.pathname).replace(/^\/+/, '');
        if (p === '' || p.endsWith('/')) p += 'index.html';

        const paths = new Set();
        paths.add(p);
        if (!/\.[a-z0-9]+$/i.test(p)) paths.add(p + '.html'); // /blog-posts -> blog-posts.html
        paths.add(p.toLowerCase());
        return [...paths];
    }

    async function tryFetch(path, branch) {
        const url = `https://api.github.com/repos/${USER}/${REPO}/commits`
                  + `?path=${encodeURIComponent(path)}&sha=${branch}&per_page=1`;
        const res = await fetch(url, {
            headers: { 'Accept': 'application/vnd.github+json' }
        });
        if (res.status === 403) throw new Error('rate-limited');
        if (!res.ok) return null;
        const data = await res.json();
        return (Array.isArray(data) && data.length) ? data[0] : null;
    }

    async function fetchPageStats() {
        try {
            for (const branch of BRANCHES) {
                for (const path of candidatePaths()) {
                    const commit = await tryFetch(path, branch);
                    if (commit) return render(commit);
                }
            }
            // Fallback: latest commit on the repo (any file)
            for (const branch of BRANCHES) {
                const commit = await tryFetch('', branch);
                if (commit) return render(commit, true);
            }
            timeEl.innerText = 'Unknown (file not tracked)';
            msgEl.innerText  = 'N/A';
        } catch (err) {
            console.error('github-update:', err);
            if (err.message === 'rate-limited') {
                timeEl.innerText = 'Temporarily unavailable';
                msgEl.innerText  = 'GitHub API rate limit reached — try again in ~1 hour.';
            } else {
                timeEl.innerText = 'Unavailable';
                msgEl.innerText  = 'N/A';
            }
        }
    }

    function render(commit, isRepoWide = false) {
        const when = new Date(commit.commit.committer.date);
        timeEl.innerText = when.toLocaleString(undefined, {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
        });
        const firstLine = commit.commit.message.split('\n')[0];
        const sha = commit.sha.substring(0, 7);
        msgEl.innerHTML =
            `${commit.html_url}ank" rel="noopener">${sha}</a> — ` +
            firstLine.replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c])) +
            (isRepoWide ? ' <em>(repo-wide)</em>' : '');
    }

    fetchPageStats();
});
