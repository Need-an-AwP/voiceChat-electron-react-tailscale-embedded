import { useDroppable } from '@dnd-kit/core';
import User from './User';

export default function Channel({ channel, users = [], type }) {
    const { setNodeRef } = useDroppable({
        id: channel.id,
        data: {
            type: 'channel',
            channel
        }
    });

    return (
        <div
            ref={setNodeRef}
            className="p-3 bg-secondary/20 rounded-lg"
        >
            <div className="font-medium mb-2 flex items-center">
                {channel.type === 'voice' ? '🔊' : '💬'} {channel.name}
            </div>
            <div className="space-y-1">
                {users.map(user => (
                    <User
                        key={user.id}
                        user={user}
                        channelId={channel.id}
                    />
                ))}
            </div>
        </div>
    );
}