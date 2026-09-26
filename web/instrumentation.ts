// Pages are rendered on the server: show match times in Nigerian time there (the browser then
// shows each visitor's own time, which for Nigeria is the same).
export function register() {
  process.env.TZ = "Africa/Lagos";
}
