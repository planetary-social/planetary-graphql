# planetary-graphql

This is a graphql server that is designed to complement a room-server.
When properly configured it will provide a GraphQL API allowing you to query:
- details about the room (name, notices)
- membership of the room
- posts made by room members

The data provided by this API conforms to the [ssb-public-web-hosting-spec]

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
        - these environment variables are required for room related API:
            - `ROOM_KEY` - ssb id of the room
            - `ROOM_HOST` - the hostname of the room
            - `ROOM_URL` - the URL the room is being served at. This should be an absolute URL. E.g. `https://localhost:3000` or `https://civic.love`
            - `MAGIC_TOKEN` - the token used to bypass invites for the `go-ssb-room` server
7. install [pm2](https://www.npmjs.com/package/pm2) (process manager)
   ```bash
   npm install pm2 -g
   pm2 startup
   ```
8. start the process!
   ```bash
   npm start
   ```
9. check the server is live using your browser
   - visit e.g. `http://157.230.72.191:4000/graphql` (assume default PORT)


Other useful commands:

```bash
npm run stop          // close the pm2 process does
pm2 restart graphql   // restart the graphql process
pm2 monit             // detailed monitoring for pm2 processes
```

#### Pair with a Room Server

You will need to add this peer as a member of the room (so that it can poll the room for updates).

1. open the `secret` file at `DB_PATH/secret` (default: `./db/secret`)
2. copy the `id` from this file
3. in the room-server, add this `id` as a member

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

<!-- References -->

ssb-public-web-hosting-spec: https://github.com/ssbc/ssb-public-web-hosting-spec

