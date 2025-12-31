# Resolving Merge Conflict in build.yml

## Steps to Resolve

1. **Update your branch with latest main:**
   ```bash
   git fetch origin main
   git merge origin/main
   ```

2. **If there's a conflict, you'll see:**
   ```
   Auto-merging .github/workflows/build.yml
   CONFLICT (content): Merge conflict in .github/workflows/build.yml
   ```

3. **Open the file and look for conflict markers:**
   ```yaml
   <<<<<<< HEAD
   # Your changes (our branch)
   =======
   # Changes from main
   >>>>>>> origin/main
   ```

4. **Resolve the conflict by keeping our new structure:**
   - Our branch has the 4 jobs (build-x64-fat, build-x64-lite, build-arm64-fat, build-arm64-lite)
   - The main branch might have the old 2 jobs (build-x64, build-arm64)
   - **Keep our version** (the 4-job structure)

5. **After resolving:**
   ```bash
   git add .github/workflows/build.yml
   git commit -m "Resolve merge conflict in build.yml - keep 4-job structure"
   git push
   ```

## Quick Resolution

If the conflict is just about job names/structure, you can accept our version entirely:

```bash
git checkout --ours .github/workflows/build.yml
git add .github/workflows/build.yml
git commit -m "Resolve merge conflict - keep new 4-job structure"
git push
```

This keeps our version (4 jobs: fat/lite for each architecture).

