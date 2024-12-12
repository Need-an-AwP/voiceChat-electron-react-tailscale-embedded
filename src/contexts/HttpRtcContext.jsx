import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useTailscale } from './TailscaleContext';
import { useDB } from './DBContext';

const RTCContext = createContext();

export const RTCProvider = ({ children }) => {
    const { status, selfIPs, selfUUID } = useTailscale();
    const blankStreamRef = useRef(null);
    const blankVideoStreamRef = useRef(null);
    const blanktrackIdRef = useRef(null);
    const askIntervalsRef = useRef({});
    const RTCs = useRef({});
    const [rtcStates, setRtcStates] = useState({});
    const rtcLocalPCsRef = useRef({});
    const pendingMessages = useRef({});
    const receivedStreamRef = useRef({});
    const receivedVideoStreamRef = useRef({});
    const receivedTrackIdRef = useRef({});
    const [inVoiceChannel, setInVoiceChannel] = useState({});
    const [users, setUsers] = useState({});
    const [inScreenShare, setInScreenShare] = useState({});
    const [channels, setChannels] = useState([]);
    const { isInitialized, configVersion, getUserConfig } = useDB();
    const localUserConfigRef = useRef(null);

    useEffect(() => {
        if (!isInitialized) return;

        getUserConfig().then(config => {
            localUserConfigRef.current = config;
            Object.entries(RTCs.current).forEach(([address, rtc]) => {
                if (rtc.dataChannel?.readyState === 'open') {
                    rtc.dataChannel.send(JSON.stringify({
                        type: 'user_config',
                        config
                    }));
                }
            })
        })
    }, [isInitialized, configVersion])


    class RTCPeer {
        constructor(peer, offer = false) {
            this.offer = offer;
            this.peer = peer;
            this.address = peer.TailscaleIPs[0];
            this.rtcLocalPC;
            this.transceivers;
            this.dataChannel;
            this.offerWaitingTimer;
            this.pingTime;
            this.pingTimeOut;
            setRtcStates(prev => ({
                ...prev,
                [this.address]: {
                    state: 'waiting',
                    latency: 0,
                    peer: peer,
                    isOffer: offer,
                    userConfig: null
                }
            }));
            this.processPendingMessages();
            this.offerORanswer();
            this.offerWaitingTimer;
            this.trackHasAudio = false;
        }

        updateState(updates) {
            setRtcStates(prev => ({
                ...prev,
                [this.address]: {
                    ...prev[this.address],
                    ...updates
                }
            }));
        }

        processPendingMessages() {
            const pendingData = pendingMessages.current[this.address]
            if (pendingData) {
                switch (pendingData.type) {
                    case 'offer-with-candidates':
                        this.handleOfferWithCandidates(pendingData);
                        break;
                    case 'answer-with-candidates':
                        this.handleAnswerWithCandidates(pendingData);
                        break;
                    case 'ask-offer':
                        break;
                    default:
                        console.log('unknown pending message type:', pendingData.type);
                        break;
                }

                delete pendingMessages.current[this.address]
            }
        }

        offerORanswer() {
            if (this.offer) {
                this.createLocalRTCConnection();
            } else {
                this.waitOffer()
            }
        }

        async createLocalRTCConnection() {
            if (this.rtcLocalPC) {
                this.rtcLocalPC.close();
                this.rtcLocalPC = null;
                if (this.dataChannel) {
                    this.dataChannel.close();
                    this.dataChannel = null;
                }
            }

            const pc = new RTCPeerConnection();
            this.rtcLocalPC = pc;
            rtcLocalPCsRef.current[this.address] = pc;

            // voice blank track
            const blankStream = blankStreamRef.current
            blankStream.getTracks().forEach(track => pc.addTrack(track, blankStream))

            // video blank track
            const blankVideoStream = blankVideoStreamRef.current
            blankVideoStream.getTracks().forEach(track => pc.addTrack(track, blankVideoStream))

            // create data channel
            this.dataChannel = pc.createDataChannel('data', { ordered: false });
            this.setupDataChannel(this.dataChannel);

            // create offer
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)

            const iceCandidates = [];
            pc.onicecandidate = e => {
                if (e.candidate) {
                    iceCandidates.push(e.candidate);
                }
            }

            pc.onicegatheringstatechange = () => {
                if (pc.iceGatheringState === 'complete') {
                    console.log('ICE gathering completed');
                    // send offer and candidates together in one http request
                    try {
                        http_send(this.address, {
                            type: 'offer-with-candidates',
                            sender: { ipv4: selfIPs.ipv4, ipv6: selfIPs.ipv6 },
                            offer: pc.localDescription,
                            candidates: iceCandidates
                        });
                    } catch (err) {
                        console.error('Error sending offer:', err);
                    }
                }
            };

            pc.oniceconnectionstatechange = () => {
                console.log('offer side ICE connection state:', pc.iceConnectionState);
                this.updateState({
                    state: pc.iceConnectionState,
                    latency: 0
                });
            };

            pc.ontrack = (e) => {
                const { streams, track, transceiver } = e;
                console.log(transceiver)

                if (streams[0].getTracks().length === 2) {
                    console.log('offer side received video stream');
                    receivedVideoStreamRef.current[this.address] = streams[0]
                } else if (streams[0].getTracks().length === 1) {
                    console.log('offer side received voice stream');
                    receivedStreamRef.current[this.address] = streams[0]
                }
                // console.log('offer side received stream:', e.streams, 'stream 0 has track:', e.streams[0].getTracks());
                // receivedStreamsRef.current[this.address] = e.streams
            }
        }

        setupDataChannel(dataChannel) {
            dataChannel.onopen = () => {
                console.log('data channel opened');

                this.pingInterval = setInterval(() => {
                    dataChannel.send(JSON.stringify({ type: 'ping' }));
                    this.pingTime = Date.now();
                    this.pingTimeOut = setTimeout(() => {
                        this.latency = -1;
                    }, 5000);
                }, 1000);

                if (localUserConfigRef.current) {
                    dataChannel.send(JSON.stringify({
                        type: 'user_config',
                        config: localUserConfigRef.current,
                        // trackId: blanktrackIdRef.current
                    }));
                }

                if (inVoiceChannel) {
                    // TODO: sync inVoiceChannel info to peers
                }
            }

            dataChannel.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data)
                    switch (data.type) {
                        default:
                            console.log('unknown data channel message type:', data.type);
                            break
                        case 'ping':
                            dataChannel.send(JSON.stringify({ type: 'pong' }))
                            break
                        case 'pong':
                            this.updateState({ latency: Date.now() - this.pingTime });
                            clearTimeout(this.pingTimeOut);
                            break
                        case 'join_voiceChannel':
                            if (!data.channel) return;
                            setInVoiceChannel(prev => ({
                                ...prev,
                                [data.sender.ipv4]: data.channel
                            }));
                            break
                        case 'leave_voiceChannel':
                            if (!data.sender.ipv4) return;
                            setInVoiceChannel(prev => {
                                const newState = { ...prev };
                                delete newState[data.sender.ipv4];
                                return newState;
                            });
                            break
                        case 'start_screen_share':
                            if (!data.channel) return;
                            setInScreenShare(prev => ({
                                ...prev,
                                [data.sender.ipv4]: data.channel
                            }));
                            break
                        case 'new_channel':
                            if (!data.channel) return;
                            setChannels(prev => [...prev, data.channel]);
                            break
                        case 'delete_channel':
                            if (!data.channel) return;
                            setChannels(prev => prev.filter(channel => channel.id !== data.channel.id));
                            break
                        case 'user_config':
                            // receivedTrackIdRef.current[this.address] = data.trackId;
                            this.updateState({ userConfig: data.config });
                            console.log('user config received:', data.config);
                            break;
                    }
                } catch (err) {
                    console.error('data channel message error:', err);
                }
            };

            dataChannel.onclose = () => {
                if (this.pingInterval) {
                    clearInterval(this.pingInterval);
                }
            };

            return dataChannel;
        }

        async handleAnswerWithCandidates(data) {
            if (!this.rtcLocalPC) return;

            this.rtcLocalPC.setRemoteDescription(data.answer)

            for (let ice of data.candidates) {
                try {
                    await this.rtcLocalPC.addIceCandidate(ice)
                } catch (err) {
                    console.error('Error adding ice candidate:', err);
                }
            }
        }

        async handleOfferWithCandidates(data) {
            const r_pc = new RTCPeerConnection()
            this.rtcLocalPC = r_pc;

            const iceCandidates = [];
            r_pc.onicecandidate = e => {
                if (e.candidate) {
                    iceCandidates.push(e.candidate);
                }
            };

            r_pc.onicegatheringstatechange = () => {
                if (r_pc.iceGatheringState === 'complete') {
                    console.log('Answer ICE gathering completed');
                    // send answer and candidates together in one http request
                    http_send(data.sender.ipv4, {
                        type: 'answer-with-candidates',
                        sender: { ipv4: selfIPs.ipv4, ipv6: selfIPs.ipv6 },
                        answer: r_pc.localDescription,
                        candidates: iceCandidates
                    });
                }
            };

            r_pc.oniceconnectionstatechange = () => {
                console.log('answer side ICE connection state:', r_pc.iceConnectionState);
                this.updateState({
                    state: r_pc.iceConnectionState,
                    latency: 0
                });
            };

            r_pc.ondatachannel = e => {
                this.dataChannel = e.channel;
                this.setupDataChannel(e.channel);
            }

            r_pc.ontrack = (e) => {
                const { streams, track, transceiver } = e;

                if (streams[0].getTracks().length === 2) {
                    console.log('answer side received video stream');
                    receivedVideoStreamRef.current[this.address] = streams[0]
                } else if (streams[0].getTracks().length === 1) {
                    console.log('answer side received voice stream');
                    receivedStreamRef.current[this.address] = streams[0]
                }
                // console.log('answer side received stream:', e.streams, 'stream 0 has track:', e.streams[0].getTracks());
                // receivedStreamsRef.current[this.address] = e.streams
            }

            // operate pc after setting all listeners
            await r_pc.setRemoteDescription(data.offer)
            if (blankStreamRef.current) {
                const blankStream = blankStreamRef.current
                blankStream.getTracks().forEach(track => r_pc.addTrack(track, blankStream))
                const answer = await r_pc.createAnswer()
                await r_pc.setLocalDescription(answer)
            }

            for (let ice of data.candidates) {
                try {
                    await r_pc.addIceCandidate(ice)
                } catch (err) {
                    console.error('Error adding ice candidate:', err);
                }
            }
        }

        async waitOffer() {
            if (this.offerWaitingTimer) {
                clearInterval(this.offerWaitingTimer);
            }
            this.offerWaitingTimer = setInterval(() => {
                // "checking" | "closed" | "completed" | "connected" | "disconnected" | "failed" | "new";
                if (!RTCs.current[this.address].rtcLocalPC) {
                    console.log(`go ask for offer from ${this.address} - ${this.peer.HostName}`);
                    http_send(this.address, {
                        type: 'ask-offer',
                        sender: { ipv4: selfIPs.ipv4, ipv6: selfIPs.ipv6 },
                    });
                } else if (['waiting', 'failed', 'closed'].includes(this.rtcLocalPC.iceConnectionState)) {
                    console.log(`wait ${this.address} - ${this.peer.HostName} timeout, ask offer again`);
                    http_send(this.address, {
                        type: 'ask-offer',
                        sender: { ipv4: selfIPs.ipv4, ipv6: selfIPs.ipv6 },
                    });
                }
            }, 10000);
        }

        async replaceAudioTrack(finalStream) {
            if (!this.rtcLocalPC) return;

            const senders = this.rtcLocalPC.getSenders()
            senders.forEach(sender => {
                if (sender.track && sender.track.id === blanktrackIdRef.current['voice-audio']) {
                    finalStream.getTracks().forEach(track => sender.replaceTrack(track))
                }
            });
            this.trackHasAudio = true;
            console.log('replaced audio track for ', this.address);
        }

        async replaceVideoTrack(captureStream) {
            if (!this.rtcLocalPC) return;

            const senders = this.rtcLocalPC.getSenders();
            senders.forEach(sender => {
                // 使用之前存储的空白视频轨道ID进行匹配
                if (sender.track && sender.track.id === blanktrackIdRef.current['screen-video']) {
                    // 替换视频轨道
                    const videoTrack = captureStream.getVideoTracks()[0];
                    sender.replaceTrack(videoTrack);
                }
                // 如果捕获的流中包含音频轨道，也替换音频轨道
                if (sender.track && sender.track.id === blanktrackIdRef.current['screen-audio']) {
                    const audioTrack = captureStream.getAudioTracks()[0];
                    if (audioTrack) {
                        sender.replaceTrack(audioTrack);
                    }
                }
            });

            console.log('replaced video tracks for', this.address);
        }
    }


    useEffect(() => {
        //initialize empty tracks
        const emptyAudioContext = new (window.AudioContext || window.webkitAudioContext)();

        const voiceTrack =
            emptyAudioContext.createMediaStreamDestination()
                .stream.getAudioTracks()[0];
        const screenAudioTrack =
            emptyAudioContext.createMediaStreamDestination()
                .stream.getAudioTracks()[0];

        const emptyVideoTrack = (() => {
            const canvas = document.createElement('canvas');
            canvas.width = 640;
            canvas.height = 480;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            const stream = canvas.captureStream();
            const track = stream.getVideoTracks()[0];
            return track;
        })();

        // blankStreamRef.current = new MediaStream([
        //     voiceTrack,
        //     emptyVideoTrack,
        //     screenAudioTrack
        // ]);
        blankStreamRef.current = new MediaStream([voiceTrack]);
        blankVideoStreamRef.current = new MediaStream([emptyVideoTrack, screenAudioTrack]);

        // still useful in replace track
        blanktrackIdRef.current = {
            'voice-audio': voiceTrack.id,
            'screen-audio': screenAudioTrack.id,
            'screen-video': emptyVideoTrack.id
        }
        console.log(blanktrackIdRef.current);


        const httpMessageReceiver = window.ipcBridge.receive('http-server-message', (msg) => {
            console.log('http-server-message', msg);
            try {
                const clientIP = msg.from
                const data = JSON.parse(msg.message)
                if (data.type === 'uuid') return;

                const ip = data.sender.ipv4
                const rtc = RTCs.current[ip]
                if (rtc) {
                    switch (data.type) {
                        case 'offer-with-candidates':
                            rtc.handleOfferWithCandidates(data);
                            break;
                        case 'answer-with-candidates':
                            rtc.handleAnswerWithCandidates(data);
                            break;
                        case 'ask-offer':
                            rtc.createLocalRTCConnection();// recreate local rtc connection and send offer
                            break;
                        default:
                            console.log('unknown message type:', data.type);
                            break;
                    }
                } else {
                    console.log(`no rtc for ${ip}, stored it`);
                    pendingMessages.current[ip] = data;
                }

            } catch (err) {
                console.error('something wrong when processing received message', err);
            }
        })



        return () => {
            window.ipcBridge.removeListener('http-server-message', httpMessageReceiver);
        };
    }, []);


    useEffect(() => {
        if (!status?.Peer || !selfUUID) return;

        Object.values(status.Peer).forEach(async peer => {
            const address = peer.TailscaleIPs[0];
            if (peer.Online && !RTCs.current[address] && !askIntervalsRef.current[address]) {

                askIntervalsRef.current[address] = setInterval(async () => {
                    try {
                        const response = await http_send(address, {
                            type: 'uuid',
                            sender: { ipv4: selfIPs.ipv4, ipv6: selfIPs.ipv6 },
                            uuid: selfUUID
                        });
                        const data = await response.text();
                        const json = JSON.parse(data);
                        if (json.type === 'uuid' && json.uuid) {
                            const peerUUID = json.uuid
                            clearInterval(askIntervalsRef.current[address]);
                            if (Number(peerUUID) > Number(selfUUID)) {
                                console.log(`create offer and send to ${address}`)
                                RTCs.current[address] = new RTCPeer(peer, true);
                            } else {
                                console.log(`wait for offer from ${address}`)
                                RTCs.current[address] = new RTCPeer(peer);
                            }
                        }
                    } catch (err) {
                        console.log(`获取 ${address} 的 UUID 失败:`, err);
                    }
                }, 5000);
            }
        });

        return () => { }
    }, [status, selfUUID]);

    useEffect(() => {
        const newUsers = {};
        Object.entries(inVoiceChannel).forEach(([address, peerChannel]) => {
            if (!newUsers[peerChannel.id]) {
                newUsers[peerChannel.id] = [];
            }
            newUsers[peerChannel.id].push({ id: address, ip: address, name: address });
        });
        setUsers(newUsers);
    }, [inVoiceChannel])

    const http_send = (targetHost, message, timeout = 5000) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        return fetch(`http://127.0.0.1:8849/?target=${targetHost}:8848/RTC`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(message),
            signal: controller.signal
        })
            .then(res => {
                clearTimeout(timeoutId);
                if (res.ok) {
                    return res;
                }
                throw res;
            })
            .catch(err => {
                clearTimeout(timeoutId);
                if (err.name === 'AbortError') {
                    throw new Error('请求超时');
                }
                throw err;
            });
    }

    const value = {
        RTCs,
        rtcStates,
        receivedStream: receivedStreamRef.current,
        receivedVideoStream: receivedVideoStreamRef.current,
        receivedTrackId: receivedTrackIdRef.current,
        inVoiceChannel,
        setInVoiceChannel,
        users,
        setUsers,
        inScreenShare,
        setInScreenShare,
        channels,
        setChannels,
    }

    return (
        <RTCContext.Provider value={value}>
            {children}
        </RTCContext.Provider>
    )
}

export const useRTC = () => {
    const rtc = useContext(RTCContext);
    if (!rtc) {
        throw new Error('useRTC must be used within a RTCProvider');
    }
    return rtc;
}