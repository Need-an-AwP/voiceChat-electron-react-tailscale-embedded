import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogClose,
    DialogFooter
} from "@/components/ui/dialog"
import { useDB } from "@/contexts/DBContext"
import { useTailscale } from "@/contexts/TailscaleContext"

export default function NetworkSelector() {
    const { status, loginName } = useTailscale();
    const { getAllNetworks } = useDB();
    const [networks, setNetworks] = useState([]);

    useEffect(() => {
        getAllNetworks().then(setNetworks);
    }, [])

    return (
        <div>
            {networks.map((network) => (
                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="outline" className="w-full">
                            {network.network_name}
                            {network.network_id === status.Self.UserID &&
                                <span className="text-xs text-gray-500">(current)</span>
                            }
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Change to Network: <span className="font-light">{network.network_name}</span></DialogTitle>
                            <DialogDescription>
                                Change to this network will disconnect all webRTC connections and reload the whole app.
                            </DialogDescription>
                        </DialogHeader>
                        {network.network_id === status.Self.UserID ?
                            <>
                                <span className="text-sm font-bold">You are already in {network.network_name} network.</span>
                                <DialogFooter className="mt-10 sm:justify-between">
                                    <DialogClose asChild>
                                        <Button variant="outline">Cancel</Button>
                                    </DialogClose>
                                </DialogFooter>
                            </>
                            :
                            <DialogFooter className="mt-10 sm:justify-between">
                                <DialogClose asChild>
                                    <Button variant="outline">Cancel</Button>
                                </DialogClose>
                                <DialogClose asChild>
                                    <Button>Confirm</Button>
                                </DialogClose>
                            </DialogFooter>
                        }
                    </DialogContent>
                </Dialog>
            ))}
        </div>
    )
}