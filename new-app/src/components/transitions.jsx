import React from 'react'
import PropTypes from 'prop-types'
import { CSSTransition } from 'react-transition-group'

const Appear = ({ duration, children, nodeRef }) => (
  <CSSTransition
    in
    classNames="Appear"
    timeout={duration || 1000}
    appear
    nodeRef={nodeRef}
  >
    {children}
  </CSSTransition>
)

Appear.propTypes = {
  duration: PropTypes.number,
  children: PropTypes.any,
}

export { Appear }
