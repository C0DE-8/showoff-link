import { Link } from 'react-router-dom'
import { FiArrowLeft, FiStar } from 'react-icons/fi'
export default function NotFound() { return <main className="not-found"><span className="auth-mark"><FiStar /></span><div className="section-kicker">A LITTLE OFF THE MAP</div><h1>This link wandered off.</h1><p>Let’s get you back to the good stuff.</p><Link className="button button-dark" to="/"><FiArrowLeft /> Back to home</Link></main> }
