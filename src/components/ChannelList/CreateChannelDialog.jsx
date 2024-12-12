import { useState } from "react";
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Copy } from "lucide-react";
import { useTailscale } from "@/contexts/TailscaleContext";
import { useRTC } from "@/contexts/HttpRtcContext";


const CreateChannelDialog = ({ type, setChannels }) => {
    const [channelName, setChannelName] = useState("");
    const { loginName, selfIPs } = useTailscale();
    const { RTCs } = useRTC();

    const handleCreateChannel = async () => {
        const response = await fetch(`http://1.12.226.82:3000/channel/${loginName}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                channel_name: channelName,
                channel_type: type
            }),
        });
        const data = await response.json();
        if (data.success) {
            console.log("Channel created successfully, ", data);
            setChannelName("");
            const newChannel = { id: data.channelId, name: channelName, type }
            setChannels(prev => [...prev, newChannel]);
            // broadcast new channel to peers
            Object.entries(RTCs.current).forEach(([address, rtc]) => {
                if (rtc.dataChannel?.readyState === 'open') {
                    rtc.dataChannel.send(JSON.stringify({
                        type: 'new_channel',
                        sender: { ipv4: selfIPs.ipv4, ipv6: selfIPs.ipv6 },
                        channel: newChannel,
                    }));
                }
            })
        } else {
            console.error("Failed to create channel");
        }
    }

    return (
        <Dialog>
            <DialogTrigger asChild>
                <div className="rounded-md hover:bg-secondary/60 p-1 m-2 cursor-pointer">
                    <Plus className="w-4 h-4" />
                </div>
            </DialogTrigger>
            <DialogContent >
                <DialogHeader>
                    <DialogTitle>Create a {type} channel</DialogTitle>
                    <DialogDescription>
                        Create a new channel with a name.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-row items-center space-x-4">
                    <span className="text-sm whitespace-nowrap">Channel name</span>
                    <Input
                        id="link"
                        value={channelName}
                        onChange={(e) => setChannelName(e.target.value)}
                    />

                </div>
                <DialogFooter className="sm:justify-between mt-10">
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">
                            Close
                        </Button>
                    </DialogClose>
                    <DialogClose asChild>
                        <Button
                            type="submit"
                            disabled={channelName.length === 0}
                            onClick={handleCreateChannel}
                        >Create</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default CreateChannelDialog
