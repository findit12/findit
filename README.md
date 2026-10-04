# FindIt

## Run the project on a new computer

1. Install Node.js (version 20 or newer) and PostgreSQL.

2. Create a PostgreSQL database named `findit`.

3. Clone this repository and open its folder in a terminal.

4. Install the project packages:

   ```powershell
   npm install
   npm install --prefix client
   npm install --prefix server
   ```

5. Copy `server/.env.example` to a new file named `server/.env`.

6. Edit `server/.env` and set these values:

   ```env
   DATABASE_URL=postgresql://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/findit
   JWT_SECRET=choose-a-long-random-secret
   CLIENT_URL=http://localhost:5173
   SCHOOL_EMAIL_DOMAIN=your-school.edu
   PORT=3000
   ```

7. Start the app:

   ```powershell
   npm run dev
   ```

8. Open `http://localhost:5173` in a browser.

9. For verification and password-reset emails, open `http://localhost:3000/dev-emails/`. This is a local inbox built into the project and does not require an email account or SMTP service.

## If the app does not start

1. Check that PostgreSQL is running.
2. Check the password in `DATABASE_URL`.
3. Check that the `findit` database exists.
4. Stop the app with `Ctrl+C` and run `npm run dev` again.
