import { useEffect, useRef, useState } from 'react';
import { useRTC } from "@/contexts/HttpRtcContext"
import { useTailscale } from "@/contexts/TailscaleContext"
import { useAudio } from "@/contexts/AudioContext"
import { useVoiceStream } from '@/contexts/VoiceStreamContext';

import { LucideAudioLines, LucideSettings } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import User from './User';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"


export default function VoiceChannel({ channel, users, joinVoiceChannel, setChannels, disabled = false }) {
    const { finalStream, selfAudioActive } = useAudio();
    const { selfIPs, loginName } = useTailscale();
    const {
        RTCs, rtcStates,
        receivedStreams, receivedTrackId,
        inVoiceChannel, setInVoiceChannel
    } = useRTC();
    const { audioActiveRef, gainNodesRef } = useVoiceStream();

    const { setNodeRef, isOver: dropIsOver } = useDroppable({
        id: channel.id
    });


    const deleteThisChannel = () => {
        const deleteChannel = async () => {
            try {
                const res = await fetch(`http://1.12.226.82:3000/channel/${loginName}/${channel.id}`, {
                    method: 'DELETE',
                })
                if (res.ok) {
                    console.log('delete channel success');
                    // delete from usestate
                    setChannels(prev => prev.filter(c => c.id !== channel.id));

                    // broadcast delete channel to peers
                    Object.entries(RTCs.current).forEach(([address, rtc]) => {
                        if (rtc.dataChannel?.readyState === 'open') {
                            rtc.dataChannel.send(JSON.stringify({
                                type: 'delete_channel',
                                sender: { ipv4: selfIPs.ipv4, ipv6: selfIPs.ipv6 },
                                channel: channel,
                            }));
                        }
                    })
                } else {
                    console.error('delete channel failed:', res);
                }
            } catch (e) {
                console.error('delete channel error:', e);
            }
        }

        deleteChannel().catch(e => console.error('delete channel failed:', e));
    }

    return (
        <div
            ref={setNodeRef}
            className={cn(
                "space-y-1 w-full rounded-md bg-secondary/30 cursor-pointer hover:bg-secondary/10",
                dropIsOver && "bg-secondary/80",
                disabled && "opacity-50 cursor-not-allowed pointer-events-none"
            )}
            onDoubleClick={() => {
                if (disabled) return;
                joinVoiceChannel(channel)
            }}
        >
            <div className="flex items-center justify-between p-2 px-4 w-full">
                <div className="flex items-center gap-4 w-full">
                    <LucideAudioLines className="w-4 h-4" />
                    <p className="truncate max-w-[150px] text-sm">{channel.name}</p>
                </div>
                <div>
                    <Popover>
                        <PopoverTrigger asChild>
                            <div className="cursor-pointer">
                                <LucideSettings className="w-4 h-4" />
                            </div>
                        </PopoverTrigger>
                        <PopoverContent side="right" className="w-80 m-8 ml-0 z-50 overflow-hidden" >
                            <div className="space-y-2">
                                <p>Channel Settings</p>
                                <Button variant="destructive" onClick={() => deleteThisChannel()}>
                                    delete this channel
                                </Button>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>
            <div className="pl-4 rounded-md transition-colors duration-200">
                {users?.map((user) => {
                    const isSelf = user.ip === selfIPs.ipv4;
                    const audioActive = !isSelf ?
                        audioActiveRef.current[user.ip] : selfAudioActive;
                    const gainNode = !isSelf ?
                        gainNodesRef.current[user.ip] : undefined;

                    return (
                        <User
                            key={user.id}
                            user={user}
                            channelId={channel.id}
                            self={isSelf}
                            audioActive={audioActive}
                            gainNode={gainNode}
                        />
                    )
                }
                )}
            </div>
        </div>
    );
}