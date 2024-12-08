import React from "react";
import styled from "styled-components";

const Loader = ({ className = '', size = 54, color = 'rgb(255,255,255)', speed = 1.5 }) => {
  return (
    <StyledWrapper className={className} size={size} color={color} speed={speed}>
      <div className="loader">
        {[...Array(12)].map((_, i) => (
          <div key={i} className={`bar${i + 1}`} />
        ))}
      </div>
    </StyledWrapper>
  );
};

const StyledWrapper = styled.div`
  .loader {
    position: relative;
    width: ${props => props.size}px;
    height: ${props => props.size}px;
    border-radius: 10px;
  }

  .loader div {
    width: 8%;
    height: 24%;
    background: ${props => props.color};
    position: absolute;
    left: 50%;
    top: 30%;
    opacity: 0;
    border-radius: 50px;
    box-shadow: 0 0 3px rgba(0,0,0,0.2);
    animation: fade458 ${props => props.speed}s linear infinite;
  }

  @keyframes fade458 {
    0% {
      opacity: 1;
    }
    40% {
      opacity: 0.5;
    }
    60% {
      opacity: 0.1;
    }
    100% {
      opacity: 0.01;
    }
  }

  ${props => [...Array(12)].map((_, i) => `
    .loader .bar${i + 1} {
      transform: rotate(${i * 30}deg) translate(0, -130%);
      animation-delay: ${-i * (props.speed / 12)}s;
    }
  `).join('')}
`;

export default Loader;