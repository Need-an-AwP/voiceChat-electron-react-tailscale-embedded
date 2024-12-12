import { useState } from "react"
import { Airplay, Mic } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import HanupMotionIcon from "./HanupMotionIcon"

import { useRTC } from "@/contexts/HttpRtcContext"
import { useTailscale } from "@/contexts/TailscaleContext"


export default function InVoiceChannelPanel({ toggleCollapse }) {
    const {
        RTCs,
        rtcStates, receivedStreams,
        inVoiceChannel, setInVoiceChannel,
        inScreenShare, setInScreenShare
    } = useRTC();
    const { status, selfIPs } = useTailscale();

    const joinScreenShare = () => {
        if (inScreenShare[selfIPs.ipv4]) {
            return;
        }
        setInScreenShare(prev => ({
            ...prev,
            [selfIPs.ipv4]: true
        }))
    }

    const handleHangup = () => {
        Object.entries(RTCs.current).forEach(([address, rtc]) => {
            if (rtc.dataChannel?.readyState === 'open') {
                rtc.dataChannel.send(JSON.stringify({
                    type: 'leave_voiceChannel',
                    sender: { ipv4: selfIPs.ipv4, ipv6: selfIPs.ipv6 },
                }));
            }
        })
        setInVoiceChannel(prev => {
            const newState = { ...prev };
            delete newState[selfIPs.ipv4];
            return newState;
        })
        setInScreenShare(prev => {
            const newState = { ...prev };
            delete newState[selfIPs.ipv4];
            return newState;
        })
        toggleCollapse('right', 'expand');
    }

    if (inVoiceChannel[selfIPs.ipv4]) {
        return (
            <div className="flex flex-row justify-between">
                <div className="flex flex-row gap-2 ml-2 my-2 text-sm text-green-400">
                    {inVoiceChannel[selfIPs.ipv4].name}
                </div>

                <div>
                    <TooltipProvider delayDuration={50}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => joinScreenShare()}
                                >
                                    <Airplay className={`h-4 w-4 ${inScreenShare[selfIPs.ipv4] ? 'text-green-400' : ''}`} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Share Screen</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider delayDuration={50}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleHangup()}
                                >
                                    <HanupMotionIcon size={16} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Hangup</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </div>
        )
    } else {
        return null
    }

}