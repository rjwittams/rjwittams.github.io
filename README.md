# robert.wittams.com

Astro site. Posts are markdown files in `src/content/posts/`; the file name is
the URL slug and the frontmatter needs `title` and `date` (`description`
and `draft: true` are optional; drafts render in `npm run dev` only).

    npm install
    npm run dev      # http://localhost:4321
    npm run build    # -> dist/

Pushing to `master` builds and deploys via `.github/workflows/deploy.yml`.
`public/CNAME` pins the custom domain; `public/druid_table/` is the 2020
WebAssembly demo, served as-is.
