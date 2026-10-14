# Calendar connections

OpenSlide includes a local month view with task markers and an agenda for the selected day. Google Calendar is optional. Apple and Outlook account connections are not currently implemented.

## Connect Google Calendar

1. In Google Cloud, enable the **Google Calendar API** for your project.
2. Configure the OAuth consent screen. If the project is in testing, add your Google account as a test user.
3. Create an OAuth client with application type **Desktop app** and download its JSON file.
4. In OpenSlide, open **Calendar → Connect Google Calendar** and select that file.
5. Complete the Google sign-in in your browser and approve read-only event access.

OpenSlide uses PKCE, a random OAuth state, and a localhost callback with a three-minute timeout. It reads primary-calendar events for the selected day. Select a day or choose Refresh to reload; there is no background synchronization.

Tokens and the client configuration are encrypted using Electron safeStorage in `%APPDATA%/OpenSlide/google-calendar.enc`. They are separate from planner exports. Disconnect removes the local credentials. Account permissions can also be revoked through your Google account.

## Notion Calendar

**Open Notion Calendar** launches the provider in your browser. To see its Google events in OpenSlide, connect the underlying Google account using the steps above. Notion database events are not imported.

Connection and event-loading code is tested against simulated providers. Real account sign-in and provider behavior still need validation with your own OAuth client. Never commit credentials or screenshots containing private events.
