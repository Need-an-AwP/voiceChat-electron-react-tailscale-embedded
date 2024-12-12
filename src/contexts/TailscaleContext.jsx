import { useState, useEffect, createContext, useContext } from 'react'
import { isValidIPv4, isValidIPv6 } from '../utils/ipValidation';


const TailscaleContext = createContext()

export function TailscaleProvider({ children }) {
    const [status, setStatus] = useState(null);
    const [selfIPs, setSelfIPs] = useState({});
    const [selfUUID, setSelfUUID] = useState(null);
    const [isTailscaleAuthKey, setIsTailscaleAuthKey] = useState(false);


    useEffect(() => {
        const tailscaleInfoReceiver = window.ipcBridge.receive('tailscale-status', (status) => {
            // console.log(status);
            if (status.TailscaleIPs) {
                const selfUserID = status.Self.UserID;
                let filteredStatus = {
                    ...status,
                    Peer: {}
                }
                for (let peer in status.Peer) {
                    if (status.Peer[peer].UserID === selfUserID) {
                        filteredStatus.Peer[peer] = status.Peer[peer];
                    }
                }
                setStatus(filteredStatus);
                let ipv4, ipv6
                status.TailscaleIPs.map(ip => {

                    if (isValidIPv4(ip)) {
                        ipv4 = ip
                    } else if (isValidIPv6(ip)) {
                        ipv6 = ip
                    }
                })
                setSelfIPs({ ipv4, ipv6 });
            }
        })

        window.ipcBridge.send('ask_uuid')
        const selfUUIDReceiver = window.ipcBridge.receive('self_uuid', (uuid) => {
            setSelfUUID(uuid);
        });
        const isTailscaleAuthKeyReceiver = window.ipcBridge.receive('is_tailscale_auth_key', (isTailscaleAuthKey) => {
            setIsTailscaleAuthKey(isTailscaleAuthKey);
        });

        return () => {
            window.ipcBridge.removeListener('tailscale-status', tailscaleInfoReceiver);
            window.ipcBridge.removeListener('self_uuid', selfUUIDReceiver);
            window.ipcBridge.removeListener('is_tailscale_auth_key', isTailscaleAuthKeyReceiver);
        };
    }, [])

    const value = {
        status,
        selfIPs,
        loginName: status?.User?.[status.Self.UserID]?.LoginName,
        selfUUID,
        isTailscaleAuthKey
    }
    return (
        <TailscaleContext.Provider value={value}>
            {children}
        </TailscaleContext.Provider>
    )
}

export function useTailscale() {
    const tailscale = useContext(TailscaleContext)
    if (!tailscale) {
        throw new Error('useTailscale must be used within a TailscaleProvider')
    }
    return tailscale;
}