import { ChannelType, type ChannelState } from "../DacpRuntime"

/** Default FDC3 user channels when the host does not supply tab/channel metadata. */
export function defaultUserChannels(): ChannelState[] {
  return [
    {
      id: "fdc3.channel.1",
      type: ChannelType.user,
      context: [],
      displayMetadata: { name: "Channel 1", color: "red" },
    },
    {
      id: "fdc3.channel.2",
      type: ChannelType.user,
      context: [],
      displayMetadata: { name: "Channel 2", color: "orange" },
    },
    {
      id: "fdc3.channel.3",
      type: ChannelType.user,
      context: [],
      displayMetadata: { name: "Channel 3", color: "yellow" },
    },
    {
      id: "fdc3.channel.4",
      type: ChannelType.user,
      context: [],
      displayMetadata: { name: "Channel 4", color: "green" },
    },
    {
      id: "fdc3.channel.5",
      type: ChannelType.user,
      context: [],
      displayMetadata: { name: "Channel 5", color: "blue" },
    },
    {
      id: "fdc3.channel.6",
      type: ChannelType.user,
      context: [],
      displayMetadata: { name: "Channel 6", color: "purple" },
    },
    {
      id: "fdc3.channel.7",
      type: ChannelType.user,
      context: [],
      displayMetadata: { name: "Channel 7", color: "pink" },
    },
    {
      id: "fdc3.channel.8",
      type: ChannelType.user,
      context: [],
      displayMetadata: { name: "Channel 8", color: "grey" },
    },
  ]
}
