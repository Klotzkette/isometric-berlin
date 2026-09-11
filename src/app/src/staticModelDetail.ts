/** Static authored city detail is identical on touch and pointer devices.
 * Resource scheduling and Minecraft style remain independent policies.
 */
export function staticModelDetailProfile(
  _requested: "full" | "mobile" = "full",
): "full" | "mobile" {
  return "full";
}
