import MicphoneSettings from './MicphoneSettings'
import HeadphoneSettings from './HeadphoneSettings'
import AudioCaptureSettings from './AudioCaptureSettings'
import SettingPopover from './SettingPopover'
import UserProfile from './UserProfile'
import InVoiceChannelPanel from './InVoiceChannelPanel'


const UserPanel = ({
    isSettingPopoverOpen,
    setIsSettingPopoverOpen,
    isAudioCapturePopoverOpen,
    setIsAudioCapturePopoverOpen,
    toggleCollapse
}) => {

    return (
        <div className='flex flex-col p-2'>
            <InVoiceChannelPanel toggleCollapse={toggleCollapse} />

            <UserProfile />

            <div className="flex justify-between pt-2">
                <MicphoneSettings />

                <HeadphoneSettings />

                <AudioCaptureSettings 
                    isAudioCapturePopoverOpen={isAudioCapturePopoverOpen}
                    setIsAudioCapturePopoverOpen={setIsAudioCapturePopoverOpen}
                />
                
                <SettingPopover 
                    isSettingPopoverOpen={isSettingPopoverOpen}
                    setIsSettingPopoverOpen={setIsSettingPopoverOpen}
                />
            </div>
        </div>
    )
}

export default UserPanel