import IdentityReview from '../components/IdentityReview';
import './IdentityReviewsPage.css';
export default function IdentityReviewsPage() {
  return <div className="identity-reviews-page"><header className="identity-page-header"><div><p>Tutor applications</p><h1>Identity reviews</h1></div><span><i className="ri-shield-user-line" aria-hidden="true"/>Private documents</span></header><IdentityReview/></div>;
}
