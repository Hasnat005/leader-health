/* Mobile navbar dropdown — smooth drop, no bounce */

@media (max-width: 768px) {
  .mobile-navbar,
  .mobile-nav,
  .navbar-mobile,
  nav[data-mobile],
  .mobile-menu {
    transform-origin: top center;
    transition:
      transform 0.3s ease-out,
      opacity 0.3s ease-out,
      max-height 0.3s ease-out !important;
    animation: navbarDropDown 0.3s ease-out forwards !important;
  }

  /* Closed state */
  .mobile-navbar[data-open="false"],
  .mobile-nav.closed,
  .navbar-mobile:not(.open),
  .mobile-menu[aria-hidden="true"] {
    transform: translateY(-100%);
    opacity: 0;
    max-height: 0;
    pointer-events: none;
  }

  /* Open state */
  .mobile-navbar[data-open="true"],
  .mobile-nav.open,
  .navbar-mobile.open,
  .mobile-menu[aria-hidden="false"] {
    transform: translateY(0);
    opacity: 1;
    max-height: 100vh;
    pointer-events: auto;
  }
}

@keyframes navbarDropDown {
  from {
    transform: translateY(-100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* Kill any bouncy spring animations */
.mobile-navbar *,
.mobile-nav *,
.navbar-mobile *,
.mobile-menu * {
  animation-timing-function: ease-out !important;
  transition-timing-function: ease-out !important;
}