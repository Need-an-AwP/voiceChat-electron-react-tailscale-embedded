import { useCallback, useEffect, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { useRTC } from "@/contexts/HttpRtcContext"
import { useAudio } from "@/contexts/AudioContext"
import { useTailscale } from "@/contexts/TailscaleContext"
import { useDB } from "@/contexts/DBContext"
import CreateChannelDialog from "./CreateChannelDialog"

import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import Loader from "@/components/loader";

import { ChevronDown, Plus, RotateCcw } from 'lucide-react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    rectIntersection,
    pointerWithin,
    getFirstCollision,
} from '@dnd-kit/core';
import { restrictToVerticalAxis, restrictToWindowEdges } from '@dnd-kit/modifiers';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import TextChannel from "./TextChannel";
import VoiceChannel from "./VoiceChannel";


const ChannelList = ({ toggleCollapse }) => {
    const { isInitialized } = useDB();
    const [inTextChannel, setInTextChannel] = useState(null);
    const { finalStream } = useAudio();
    const { status, selfIPs, loginName } = useTailscale();
    const {
        RTCs, rtcStates, receivedStreams,
        channels, setChannels,
        inVoiceChannel, setInVoiceChannel,
        users, setUsers,
        inScreenShare, setInScreenShare,
    } = useRTC();
    const [fetchLoading, setFetchLoading] = useState(false);
    const [usePresetChannels, setUsePresetChannels] = useState(false);



    const joinVoiceChannel = (channel) => {
        if (inVoiceChannel[selfIPs.ipv4]?.id === channel.id) {
            console.log('already in voice channel:', inVoiceChannel[selfIPs.ipv4])
            return;
        } else if (inVoiceChannel[selfIPs.ipv4]?.id !== channel.id) {
            console.log('change to voice channel:', channel)
        } else {
            console.log('double click to join channel:', channel)
        }

        Object.entries(RTCs.current).forEach(([address, rtc]) => {
            if (rtc.dataChannel?.readyState === 'open') {
                rtc.dataChannel.send(JSON.stringify({
                    type: 'join_voiceChannel',
                    sender: { ipv4: selfIPs.ipv4, ipv6: selfIPs.ipv6 },
                    channel: channel,
                    // won't send user info to peers, let peers find users' config by selfIPs
                }));
            }
        })
        setInVoiceChannel(prev => ({
            ...prev,
            [selfIPs.ipv4]: channel
        }));
    }

    const fetchChannels = async () => {
        try {
            setFetchLoading(true);
            setUsePresetChannels(false);

            const timeout = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('请求超时')), 5000); // 5秒超时
            });
            const fetchPromise = fetch(`http://1.12.226.82:3000/channel/${loginName}`);

            const res = await Promise.race([fetchPromise, timeout]);
            const data = await res.json();
            const channels = data.channels.map(channel => ({
                id: channel.id,
                name: channel.channel_name,
                type: channel.channel_type,
                ...channel
                // keep all original fields
            }));
            console.log(channels);
            setChannels(channels);
            setFetchLoading(false);
        } catch (error) {
            console.error(error);
            setFetchLoading(false);
            setUsePresetChannels(true);
            setChannels([
                { id: '1', name: 'test text', type: 'text' },
                { id: '2', name: 'test voice A', type: 'voice' },
                { id: '3', name: 'test voice B', type: 'voice' },
                { id: '4', name: 'test voice C', type: 'voice' },
            ]);
        }
    }

    useEffect(() => {
        if (!isInitialized || !status) return;
        // getAllChannelsSorted().then(channels => {
        //     console.log(channels);
        //     setChannels(channels);
        // })
        
        fetchChannels();

    }, [isInitialized])


    const collisionDetectionStrategy = (args) => {
        const pointerCollisions = pointerWithin(args);
        if (!pointerCollisions.length) return [];

        // 返回第一个碰撞的目标
        const firstCollision = pointerCollisions[0];
        return [firstCollision];
    };
    const [activeUser, setActiveUser] = useState(null);
    const [activeId, setActiveId] = useState(null);
    const [overId, setOverId] = useState(null);
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );
    const handleDragStart = (event) => {
        const { active } = event;
        setActiveId(active.id);
        setActiveUser(active.data.current.user);
    };

    const handleDragOver = (event) => {
        const { over } = event;
        setOverId(over?.id || null);
    };

    const handleDragEnd = (event) => {
        const { active, over } = event;

        if (!over) return;

        const activeUser = active.data.current.user;
        const fromChannelId = active.data.current.fromChannelId;
        const toChannelId = over.id;

        if (fromChannelId === toChannelId) return;

        setUsers(prev => {
            const newUsers = { ...prev };
            // 从原频道移除用户
            newUsers[fromChannelId] = prev[fromChannelId].filter(u => u.id !== activeUser.id);
            // 添加用户到新频道
            newUsers[toChannelId] = [...(prev[toChannelId] || []), activeUser];
            return newUsers;
        });
        setActiveId(null);
        setOverId(null);
        setActiveUser(null);
    };

    return (
        <>
            {usePresetChannels && (
                <div className="bg-red-500 bg-opacity-30 w-full p-1 px-4 flex flex-row items-center justify-between">
                    <span className="text-xs text-muted-foreground text-left">
                        can't get channels from server<br />
                        using preset channels now
                    </span>
                    <TooltipProvider delayDuration={100}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="bg-red-500 bg-opacity-0"
                                    onClick={() => {
                                        fetchChannels();
                                    }}
                                >
                                    <RotateCcw className="w-4 h-4 text-xs text-muted-foreground" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p className="text-xs">re-request channels from server</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                </div>
            )}
            <ScrollArea className="px-2 overflow-x-hidden select-none relative h-full">
                {/* loading */}
                {fetchLoading && (
                    <div className="absolute inset-0 bg-black bg-opacity-30 backdrop-blur-sm z-40 flex flex-col justify-center items-center">
                        <Loader size={40} />
                        <span className="text-sm text-muted-foreground">checking channels...</span>
                    </div>
                )}



                {/* text channel */}
                <Collapsible defaultOpen={true}>
                    <div className="flex flex-row w-full">
                        <CollapsibleTrigger asChild className="flex-1">
                            <div className="flex items-center justify-between px-2 py-1 my-2 gap-2 hover:bg-secondary/60 rounded-md">
                                <div className="flex justify-start text-xs text-muted-foreground whitespace-nowrap">text channels</div>
                                <div className="bg-neutral-800 h-[1px] w-full"></div>
                                <div>
                                    <ChevronDown className="w-4 h-4" />
                                </div>
                            </div>
                        </CollapsibleTrigger>
                        <CreateChannelDialog type="text" setChannels={setChannels} />
                    </div>
                    <CollapsibleContent className="space-y-2">
                        <div className="space-y-2 mb-2">
                            {channels
                                .filter(channel => channel.type === 'text')
                                .map((channel) => (
                                    <TextChannel
                                        key={channel.id}
                                        channel={channel}
                                        inTextChannel={inTextChannel}
                                        setInTextChannel={setInTextChannel}
                                    />
                                ))}
                        </div>
                    </CollapsibleContent>
                </Collapsible>

                {/* voice channel */}
                <Collapsible defaultOpen={true}>
                    <div className="flex flex-row w-full">
                        <CollapsibleTrigger asChild className="flex-1">
                            <div className="flex items-center justify-between px-2 py-1 my-2 gap-2 hover:bg-secondary/60 rounded-md">
                                <div className="flex justify-start text-xs text-muted-foreground whitespace-nowrap">voice channels</div>
                                <div className="bg-neutral-800 h-[1px] w-full"></div>
                                <div>
                                    <ChevronDown className="w-4 h-4" />
                                </div>
                            </div>
                        </CollapsibleTrigger>
                        <CreateChannelDialog type="voice" setChannels={setChannels} />
                    </div>
                    <CollapsibleContent className="space-y-2 mb-2">
                        <DndContext
                            sensors={sensors}
                            collisionDetection={collisionDetectionStrategy}
                            onDragStart={handleDragStart}
                            onDragOver={handleDragOver}
                            onDragEnd={handleDragEnd}
                            modifiers={[restrictToWindowEdges]}
                        >
                            <div className="space-y-2">
                                {channels
                                    .filter(channel => channel.type === 'voice')
                                    .map((channel) => (
                                        <VoiceChannel
                                            key={channel.id}
                                            channel={channel}
                                            type={channel.type}
                                            users={users[channel.id] || []}
                                            joinVoiceChannel={joinVoiceChannel}
                                            setChannels={setChannels}
                                        />
                                    ))}
                            </div>
                        </DndContext>
                    </CollapsibleContent>
                </Collapsible>

                {/* share channel */}
                {/* <Collapsible defaultOpen={true}>
                <div className="flex flex-row w-full">
                    <CollapsibleTrigger asChild className="flex-1">
                        <div className="flex items-center justify-between px-2 py-1 my-2 gap-2 hover:bg-secondary/60 rounded-md">
                            <div className="flex justify-start text-xs text-muted-foreground whitespace-nowrap">share channels</div>
                            <div className="bg-neutral-800 h-[1px] w-full"></div>
                            <div>
                                <ChevronDown className="w-4 h-4" />
                            </div>
                        </div>
                    </CollapsibleTrigger>
                    <CreateChannelDialog type="share" setChannels={setChannels} />
                </div>
                <CollapsibleContent className="space-y-2">
                    <div className="space-y-2 mb-2">
                        {channels
                            .filter(channel => channel.type === 'share')
                            .map((channel) => (
                                <ShareChannel
                                    key={channel.id}
                                    channel={channel}
                                    users={users[channel.id] || []}
                                    inShareChannel={inShareChannel}
                                    setInShareChannel={setInShareChannel}
                                    joinShareChannel={joinShareChannel}
                                />
                            ))}
                    </div>
                </CollapsibleContent>
            </Collapsible> */}

            </ScrollArea>
        </>
    )
}

export default ChannelList