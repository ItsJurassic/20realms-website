# 20Realms Website

A simple static website for 20Realms that can be hosted for free with GitHub Pages.

## Preview locally

Open `index.html` in a browser, or use a local static server from this folder.

With Python installed:

```powershell
python -m http.server 8000
```

Then visit http://localhost:8000.

## Customize

- Edit `index.html` to change the page text and sections.
- Edit `styles.css` to change the colors, spacing, and layout.
- Edit `script.js` for small interactive behavior.

## Publish free with GitHub Pages

1. Create a new GitHub repository, such as `20realms-website`.
2. Upload these files to the repository root.
3. In GitHub, open Settings > Pages.
4. Under Build and deployment, choose Deploy from a branch.
5. Select the `main` branch and `/root`, then save.
6. In Custom domain, enter `www.20realms.net` and save.

The `CNAME` file is already included so GitHub Pages knows to use `www.20realms.net`.

## Domain DNS

At the domain provider for `20realms.net`, create this DNS record:

```text
Type: CNAME
Name/Host: www
Value/Target: YOUR-GITHUB-USERNAME.github.io
```

Replace `YOUR-GITHUB-USERNAME` with the GitHub account that owns the website repository.

After GitHub Pages is working for `www.20realms.net`, enable Enforce HTTPS in Settings > Pages.
