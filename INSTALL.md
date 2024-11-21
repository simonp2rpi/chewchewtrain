## Installation

- Clone the repository, and `cd` into the repository directory.
- `cd chewchewtrain_server`. This is where the latest version of the server, including frontend and backend, is located.
- Run `npm i --force` (`--force` because of a weird dependency with `react-simple-snackbar`) to install all dependencies.
- Create `.env` and `firebase-credentials.json` files inside of the `chewchewtrain_server` folder. *Hint: If you're on the team Discord channel, these files are pinned, and you should copy them into that folder.*
- Run `npm run start` to run the server, which builds the frontend first. It will take a bit of time to build the frontend, using Next.js.
  - If you are only changing the API without changing the frontend, you can manually run the server through `node --env-file=.env server.js`.
  - If you are only changing the frontend without changing the `server.js` (the API), then just run `npm run next_dev` for the debug experience and faster reload times. **The API won't work when you do this, so this isn't really recommended.**

## Setting up MongoDB and Firebase separately

The following are instructions to set up separate instances of MongoDB and Firebase databases. *This is not required to be followed for those in the group.*

Upon setting up MongoDB, you must put `MONGODB=<mongodb URL>` into `.env`. 

Upon setting up Firebase, you must put `GOOGLE_APPLICATION_CREDENTIALS=firebase-credentials.json` into `.env`. Inside of `firebase-credentials.json` is the JSON credentials necessary for the Firebase Admin APIs, so that the server can change Firebase data on its side. Additionally, inside of `chewchewtrain_server/src/app/util.js`, you can replace the client-facing Firebase API keys inside the `connectToFirebase` function.