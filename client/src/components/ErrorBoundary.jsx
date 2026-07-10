import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Unhandled UI error:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="gate-wrap">
        <div className="gate-box">
          <h2 className="gate-title">Coś poszło nie tak</h2>
          <p className="gate-desc">Wystąpił nieoczekiwany błąd interfejsu. Spróbuj odświeżyć stronę.</p>
          <button className="btn" style={{ width: '100%' }} onClick={() => window.location.reload()}>
            Odśwież stronę
          </button>
        </div>
      </div>
    )
  }
}
