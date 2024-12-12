import { useState } from "react"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Card } from "@/components/ui/card"
import { Braces } from "lucide-react"
import { Button } from "@/components/ui/button"

import { useTailscale } from "@/contexts/TailscaleContext"
import { useRTC } from "@/contexts/HttpRtcContext"

import OnlineUsers from '@/components/OnlineUsers'


const RightSideBarCards = () => {
    const { status } = useTailscale();
    const { rtcStates } = useRTC();

    const checkHttpServer = async (targetHost) => {
        console.log('checkHttpServer', targetHost);
        const response = await fetch(`http://127.0.0.1:8849/?target=${targetHost}:8848/RTC`);
        if (response.ok) {
            console.log(await response.text());
        } else {
            console.log(response);
        }

        fetch(`http://127.0.0.1:8849/?target=${targetHost}:8848/RTC`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                targetHost: `${targetHost}:8848`
            })
        })
            .then(res => res.text())
            .then(text => console.log(text))
            .catch(err => console.log(err))
    }

    const checkWsServer = async (targetHost) => {
        const response = await fetch('http://127.0.0.1:8849/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                targetHost: `${targetHost}:8848`
            })
        });
        const proxyPath = await response.text();
        const ws = new WebSocket(`ws://127.0.0.1:8849${proxyPath}`);
        ws.onopen = () => {
            console.log('ws open');
            ws.send(JSON.stringify({ type: 'text', message: 'hello in ws' }));
        }
    }

    return (

        <ScrollArea className="h-full p-4">
            <div className="w-full space-y-4">
                <OnlineUsers />

                <ScrollArea className="rounded-md border bg-white bg-opacity-5 max-h-[500px]">
                    {status && (
                        <div className="space-y-4 h-full">
                            {Object.entries(status.Peer).map(([key, peer]) => (
                                <div key={key} className="peer-card text-sm flex flex-col gap-2">
                                    <strong>{peer.HostName}</strong>
                                    <div className="flex justify-center">
                                        OS:{peer.OS} UserID:{peer.UserID}<br />
                                        IPs: {peer.TailscaleIPs.join(', ')}<br />
                                        Online: {peer.Online ? '🟢' : '⚪'}<br />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </div>
        </ScrollArea>
    )
}

export default RightSideBarCards