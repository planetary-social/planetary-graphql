# planetary-pub2

## Run locally (Development)

```bash
npm install
npm run dev
```

## Deploy

### Digitial Ocean setup

1. spin up a droplet, adding SSH keys
2. assign a "reserved IP address" (static address)
3. ssh into the droplet, e.g.
    ```bash
    ssh root@157.230.72.191
    ```
4. install node
    - install [nvm](https://github.com/nvm-sh/nvm)
    - `nvm install 16`
        - (you may need to log out and in for nvm to be registered)
5. install `planetary-graphql`
    ```bash
    git clone https://github.com/planetary-social/planetary-graphql.git
    cd planetary-graphql
    npm i
    ```
6. set up environment variables
    ```bash
    cp .env.template .env
    ```
    - you will need to edit this file to make sure the details are correct`
    - `ROOM_ADDRESS` and `ROOM_URL` are optional, and only needed for room methods
7. install [pm2](https://www.npmjs.com/package/pm2) (process manager)
   ```bash
   npm install pm2 -g
   pm2 startup
   ```
8. start the process!
   ```bash
   pm2 start index.js
   ```
9. check the server is live using your browser
   - visit e.g. `http://157.230.72.191:4000/graphql` (assume default PORT)


### Health checks

If using `pm2`, you can run `pm2 list` to see the cpu/mem/uptime of your server.

Checking disk usage in the `planetary-graphql` folder:
    ```bash
    du -h db/db2
    ls -lh db/db2/log.bipf
    ```

### Update

```
cd planetary-graph
git pull origin master
npm install
pm2 restart all
```
