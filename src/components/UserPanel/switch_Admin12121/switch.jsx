import React from 'react';
import './switch.css';

const SwitchButton = ({ onChange, checked, scale = 1 }) => {
    const handleChange = (event) => {
        if (onChange) {
            onChange(event.target.checked);
        }
    };

    return (
        <div style={{ transform: `scale(${scale})` }}>
            <label className="switch-button" htmlFor="switch">
                <div className="switch-outer" >
                    <input
                        id="switch"
                        type="checkbox"
                        checked={checked}
                        onChange={handleChange}
                    />
                    <div className="button">
                        <span className="button-toggle"></span>
                        <span className="button-indicator"></span>
                    </div>
                </div>
            </label>
        </div>
    );
};

export default SwitchButton;