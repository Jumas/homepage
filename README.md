# Homepage for jumas.org

## Configuring GitHub Pages

To make the app accessible:
1. Make the project public.
2. Go to Settings -> Pages and choose a branch.
3. In Settings -> Pages, follow the custom domain configuration link and find the list of `A records`.
4. At your domain registrar, open advanced domain settings: add each A record from the previous step (use `@` for the Host), and add a CNAME record with host `www` and value `%YOUR_GITHUB_USERNAME%.github.io`.
5. Wait up to 30 minutes for the changes to propagate (use https://dnschecker.org/ to check the results).
6. In Settings -> Pages, enter your domain in the `Custom domain` field and press `Save`. Wait several minutes for everything to sync (you may see errors like `NotServedByPagesError` in the meantime—just ignore them).
