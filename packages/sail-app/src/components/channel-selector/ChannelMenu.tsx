import { Popover, PopoverContent, PopoverTrigger } from "sail-ui"
import { Check } from "lucide-react"
const recommendedChannels = [
  {
    id: "fdc3.channel.1",
    type: "user",
    displayMetadata: {
      name: "Channel 1",
      color: "red",
      glyph: "1",
    },
  },
  {
    id: "fdc3.channel.2",
    type: "user",
    displayMetadata: {
      name: "Channel 2",
      color: "orange",
      glyph: "2",
    },
  },
  {
    id: "fdc3.channel.3",
    type: "user",
    displayMetadata: {
      name: "Channel 3",
      color: "yellow",
      glyph: "3",
    },
  },
  {
    id: "fdc3.channel.4",
    type: "user",
    displayMetadata: {
      name: "Channel 4",
      color: "green",
      glyph: "4",
    },
  },
  {
    id: "fdc3.channel.5",
    type: "user",
    displayMetadata: {
      name: "Channel 5",
      color: "cyan",
      glyph: "5",
    },
  },
  {
    id: "fdc3.channel.6",
    type: "user",
    displayMetadata: {
      name: "Channel 6",
      color: "blue",
      glyph: "6",
    },
  },
  {
    id: "fdc3.channel.7",
    type: "user",
    displayMetadata: {
      name: "Channel 7",
      color: "magenta",
      glyph: "7",
    },
  },
  {
    id: "fdc3.channel.8",
    type: "user",
    displayMetadata: {
      name: "Channel 8",
      color: "purple",
      glyph: "8",
    },
  },
]

export const ChannelMenu = ({ trigger }: { trigger: React.ReactNode }) => {
  return (
    <Popover>
      <PopoverTrigger>{trigger}</PopoverTrigger>
      <PopoverContent>
        <div className="flex flex-col gap-2">
          {recommendedChannels.map(channel => (
            <>
              <div key={channel.id} className="flex items-center gap-2">
                <Check className="w-4 h-4" />
                {channel.displayMetadata.name}
              </div>

              <hr className="border-border" />
            </>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
