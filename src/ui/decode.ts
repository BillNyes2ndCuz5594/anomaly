// A transient flag: the first hub visit after check in decodes the codename. Not persisted, not part of the game state.
let armed = false
export function armCodenameDecode() {
  armed = true
}
export function peekCodenameDecode() {
  return armed
}
export function clearCodenameDecode() {
  armed = false
}
