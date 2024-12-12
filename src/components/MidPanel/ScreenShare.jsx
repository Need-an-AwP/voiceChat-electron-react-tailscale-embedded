import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { PopoverClose } from "@radix-ui/react-popover";
import { Input } from "@/components/ui/input"

import { useRTC } from "@/contexts/HttpRtcContext"
import { useTailscale } from "@/contexts/TailscaleContext"
import { X, Monitor, AppWindow, RotateCcw, Settings, OctagonX } from 'lucide-react';


const ScreenShare = () => {
    const {
        RTCs, inVoiceChannel,
        inScreenShare, setInScreenShare,
        receivedVideoStream
    } = useRTC();
    const { status, selfIPs, loginName } = useTailscale();
    const [sources, setSources] = useState([]);
    const [stream, setStream] = useState(null);
    const videoTrackRef = useRef(null);
    const videoRef = useRef(null);
    const [streamStats, setStreamStats] = useState({
        deviceId: '',
        frameRate: 0,
        cursor: false,
        width: 0,
        height: 0
    });
    const [settings, setSettings] = useState({
        frameRate: 120
    });
    const remoteVideoRef = useRef(null);
    

    const getScreenSources = useCallback(async () => {
        const sources = await window.ipcBridge.invoke('getScreenSources')
        console.log(sources);
        setSources(sources);
    }, []);

    useEffect(() => {
        if (!inScreenShare[selfIPs.ipv4]) {
            if (stream) {
                stopCapture();
            }
            return;
        }

        getScreenSources();

    }, [inScreenShare, getScreenSources]);

    useEffect(() => {
        if (!stream || !videoRef.current) return;

        if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = (e) => {
                videoRef.current.play().catch(error => {
                    console.error('Error playing video:', error);
                })
            }
        }

        const videoTrack = stream.getVideoTracks()[0];
        videoTrackRef.current = videoTrack;
        const statsCheckInterval = setInterval(() => {
            if (!videoRef.current) return;

            const { deviceId, width, height, frameRate, cursor } = videoTrack.getSettings();
            // console.log(videoTrack.getConstraints());
            setStreamStats(prev => ({
                ...prev,
                deviceId,
                width,
                height,
                frameRate,
                cursor
            }));
        }, 1000);

        return () => {
            clearInterval(statsCheckInterval);
            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }
        }
    }, [stream])

    const startCapture = async (sourceId) => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        try {
            // set source id first then use getdisplaymedia method
            window.ipcBridge.send('capture_id', sourceId);
            // const supportedConstraints = navigator.mediaDevices.getSupportedConstraints();
            // console.log('Supported constraints:', supportedConstraints);

            const captureStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    frameRate: 120,
                },
                audio: true,
            })

            setStream(captureStream);

            const currentChannel = inVoiceChannel[selfIPs.ipv4];
            if (!currentChannel) {
                console.log('no voice channel available');
                return;
            }

            Object.entries(RTCs.current)
                .map(([address, rtc]) => {
                    rtc.dataChannel.send(JSON.stringify({
                        type: 'start_screen_share',
                        sender: { ipv4: selfIPs.ipv4, ipv6: selfIPs.ipv6 },
                        channel: currentChannel,
                    }))
                    return [address, rtc];
                })
                .filter(([address, rtc]) =>
                    inVoiceChannel[address]?.id === currentChannel.id
                )
                .forEach(([address, rtc]) => {
                    rtc.replaceVideoTrack(captureStream);
                });

        } catch (error) {
            console.error('捕获失败:', error);
        }
    }

    const setCaptureSettings = (key, value) => {
        console.log(key, value);
        if (videoTrackRef.current) {
            videoTrackRef.current.applyConstraints({
                [key]: value
            })
        }
    }

    const stopCapture = useCallback(() => {
        setStream(null);

        setInScreenShare(prev => {
            const newState = { ...prev };
            delete newState[selfIPs.ipv4];
            return newState;
        });

        if (videoTrackRef.current) {
            videoTrackRef.current.stop();
            videoTrackRef.current = null;
        }

        const currentChannel = inVoiceChannel[selfIPs.ipv4];

        if (stream) {
            Object.entries(RTCs.current)
                .filter(([address]) =>
                    inVoiceChannel[address]?.id === currentChannel.id
                )
                .forEach(([address, rtc]) => {
                    stream.getTracks().forEach(track => {
                        rtc.removeTrack(track);
                    });
                    rtc.replaceVideoTrack(blankVideoStreamRef.current);
                });

            stream.getTracks().forEach(track => track.stop());

        }

        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }

        getScreenSources();

    }, [stream, inVoiceChannel, getScreenSources]);

    useEffect(() => {
        Object.entries(inScreenShare)
            .filter(([address, channel]) => address !== selfIPs.ipv4 || channel.id === inVoiceChannel[selfIPs.ipv4].id)
            .forEach(([address, channel]) => {
                if (receivedVideoStream[address] && remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = receivedVideoStream[address];
                    remoteVideoRef.current.onloadedmetadata = (e) => {
                        remoteVideoRef.current.play().catch(error => {
                            console.error('Error playing video:', error);
                        })
                    }
                }
            })
    }, [inScreenShare, receivedVideoStream])

    return (
        <><div className="flex flex-row items-center mt-6">
            {Object.entries(inScreenShare)
                .filter(([address, channel]) => address !== selfIPs.ipv4)
                .map(([address, channel]) => {
                    if (receivedVideoStream[address]) {
                        return (
                            <div key={address} className="border rounded-lg p-2">
                                <video ref={remoteVideoRef} autoPlay playsInline muted className="w-full max-h-[calc(100vh-8rem)] object-contain" />
                                <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-sm px-3 py-2 rounded-lg">
                                    <span className="text-sm text-white">
                                        {address}'s screen
                                    </span>
                                </div>
                            </div>
                        )
                    }
                })}
        </div>
            {stream ? (
                <div className="flex flex-col w-full h-full min-h-0 items-center justify-center p-8">
                    <div className="relative overflow-hidden rounded-lg border-4 border-yellow-500">
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full max-h-[calc(100vh-8rem)] object-contain"
                        />

                        <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-sm px-3 py-2 rounded-lg text-sm text-white space-y-1.5">
                            {Object.entries(streamStats).map(([key, value]) => (
                                <div className="flex items-center gap-2" key={key}>
                                    <span className="text-yellow-500">{key.charAt(0).toUpperCase() + key.slice(1)}:</span>
                                    <span>{value}</span>
                                </div>
                            ))}
                            {JSON.stringify(inScreenShare, null, 2)}
                        </div>
                        <div className="absolute bottom-0 right-0">
                            <Popover>
                                <PopoverTrigger>
                                    <div >
                                        <Button variant="ghost" size="icon">
                                            <Settings className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </PopoverTrigger>
                                <PopoverContent>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="w-full text-sm">frame rate</span>
                                        <Input
                                            value={settings.frameRate}
                                            onChange={(e) => {
                                                setSettings(prev => ({
                                                    ...prev,
                                                    frameRate: e.target.value
                                                }))
                                            }} />
                                    </div>
                                    <PopoverClose asChild>
                                        <Button
                                            className="w-full"
                                            onClick={() => {
                                                setCaptureSettings('frameRate', settings.frameRate);
                                            }}
                                            disabled={Number(settings.frameRate) < 0}
                                        >
                                            Confirm
                                        </Button>
                                    </PopoverClose>
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="absolute bottom-0 left-0">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div
                                            className="cursor-pointer rounded-full p-1 hover:bg-red-500/20 transition-colors"
                                            onClick={stopCapture}
                                        >
                                            <OctagonX className="text-red-500 h-full w-full" />
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        stop screen share
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    </div>

                </div>
            ) : (
                <ScrollArea className="px-4 m-8 h-full bg-neutral-900 rounded-lg ">
                    {true && (
                        // inScreenShare[selfIPs.ipv4]
                        <div className="my-4 space-y-4">
                            {/* screen source */}
                            <div className="flex flex-col items-center">
                                <h4 className="text-md text-muted-foreground font-bold my-2">screen sources</h4>
                                <div className="flex flex-row flex-wrap gap-4 items-center justify-center">
                                    {sources
                                        .filter(source => source.id.startsWith('screen'))
                                        .map((source) => (
                                            <div
                                                key={source.id}
                                                onClick={() => startCapture(source.id)}
                                                className="group cursor-pointer border rounded-lg p-2 hover:bg-accent transition-colors"
                                            >
                                                <div className="mb-2 overflow-hidden rounded-md">
                                                    <img
                                                        src={source.thumbnail}
                                                        alt={source.name}
                                                        className="max-h-48 object-cover"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2 px-1">
                                                    <Monitor className="h-4 w-4 text-muted-foreground" />
                                                    <span className="text-sm max-w-80 truncate">{source.name}</span>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>
                            {/* window source */}
                            <div className="flex flex-col items-center">
                                <h4 className="text-md text-muted-foreground font-bold my-2">window sources</h4>
                                <div className="flex flex-row flex-wrap gap-4 items-center justify-center">
                                    {sources
                                        .filter(source => source.id.startsWith('window'))
                                        .map((source) => (
                                            <div
                                                key={source.id}
                                                onClick={() => startCapture(source.id)}
                                                className="group cursor-pointer border rounded-lg p-2 hover:bg-accent transition-colors"
                                            >
                                                <div className="mb-2 overflow-hidden rounded-md flex items-center justify-center">
                                                    <img
                                                        src={source.thumbnail}
                                                        alt={source.name}
                                                        className="max-h-48 object-cover"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2 px-1">
                                                    {source.appIcon ? (
                                                        <img
                                                            src={source.appIcon}
                                                            alt="app icon"
                                                            className="h-4 w-4"
                                                        />
                                                    ) : (
                                                        <AppWindow className="h-4 w-4 text-muted-foreground" />
                                                    )}
                                                    <span className="text-sm max-w-80 truncate">{source.name}</span>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>

                            <div className="flex justify-end items-center gap-2">
                                <Button variant="outline" onClick={getScreenSources} className="m-2">
                                    <span className="text-sm text-muted-foreground">refresh capture sources</span>
                                    <RotateCcw className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </ScrollArea>
            )}
        </>
    )
}

export default ScreenShare