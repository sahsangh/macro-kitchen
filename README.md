# Macro Kitchen

Calorie and macro tracker built around cooking at home: save recipes, cook them into a **pantry** of leftovers, then eat them down by servings, grams or fraction. Whatever you don't finish, you throw out.

```
mobile/   Expo (React Native) app — iPhone / Android
server/   Node + Express API on MongoDB
```

## How it works

| Idea | What it means |
|---|---|
| **Food** | Calories, protein, carbs, fat and fiber per 100 g. Searches and barcode scans check our MongoDB first; only misses go to **USDA FoodData Central** and **Open Food Facts**, and every result is saved so the DB grows and repeat lookups are instant. |
| **Recipe** | Ingredients (each with grams and macros) + **no-macro extras** (spices, etc.) + servings + finished weight. |
| **Pantry item** | Created when you tap **I made this** on a recipe (or track a package). Holds the real cooked weight and what's left. Eating a portion logs it to your day and subtracts it; deleting that diary entry puts it back. |
| **Portions** | Everywhere you enter an amount you can switch between **Servings / Grams / % or fraction** (type `1/3`). All three stay in sync. |

## Setup (one time)

1. **MongoDB Atlas** (free tier): create a cluster → *Database Access*: add a user → *Network Access*: allow your IP (or `0.0.0.0/0` while testing) → *Connect → Drivers*: copy the connection string. Paste it into `server/.env` as `MONGODB_URI=…`, adding a database name before the `?` (e.g. `…mongodb.net/calrecipe?…`).
2. **USDA API key** (free, instant): https://fdc.nal.usda.gov/api-key-signup → put it in `server/.env` as `USDA_API_KEY`. `DEMO_KEY` works but allows only about 30 searches an hour.
3. Install:
   ```bash
   npm install --prefix server && npm install --prefix mobile
   ```

## Run it on your phone

1. Start the API (from the project root):
   ```bash
   npm run dev --prefix server
   ```
2. In a second terminal, start the app:
   ```bash
   cd mobile && npx expo start
   ```
3. Install **Expo Go** from the App Store and scan the QR code with the iPhone camera. Your phone needs to be on the same Wi-Fi as your Mac. The app finds the API automatically at `http://<your-mac-ip>:4000`. If it can't connect, allow incoming connections for `node` in macOS Firewall settings.

To use it away from home, deploy `server/` anywhere that runs Node (Render, Railway, Fly.io…), then set `EXPO_PUBLIC_API_URL=https://your-api…` in `mobile/.env`. For a standalone app on your home screen, use `npx eas-cli build` (needs an Apple Developer account for iOS).

## Tests

```bash
npm test --prefix server
```
Runs against an in-memory MongoDB: auth, user isolation, recipe → pantry → eat/discard/undo, portion math, search ranking, caching and retry, and barcode matching.
