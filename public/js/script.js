// Closes the Responsive Menu on Menu Item Click
$('.navbar-collapse ul li a').click(function() {
    $('.navbar-toggle:visible').click();
})

//jQuery for page scrolling feature - requires jQuery Easing plugin
$(function() {
    $(document).on('click', 'a.page-scroll', function(event) {
        var $anchor = $(this);
        $('html, body').stop().animate({
            scrollTop: $($anchor.attr('href')).offset().top
        }, 1500, 'easeInOutExpo');
        event.preventDefault();
    });
});

// Initialize and Configure Magnific Popup Lightbox Plugin
$('.popup-gallery').magnificPopup({
    delegate: '.gallery',
    type: 'image',
    tLoading: 'Loading image #%curr%...',
    mainClass: 'mfp-img-mobile',
    gallery: {
        enabled: true,
        navigateByImgClick: true,
        preload: [0, 1] // Will preload 0 - before current, and 1 after the current image
    },
});

//add of active class for table link which is clicked(index-body)
  $('.link').click(function(){
    $('.table td a.active').removeClass('active');
    $(this).addClass('active');
  })

//Activation of the tooltip
$(function(){
    $('[data-toggle="tooltip"]').tooltip()
})

// Initialize and Configure Scroll Reveal Animation
    window.sr = ScrollReveal();
    sr.reveal('.sr-icons', {
        duration: 600,
        scale: 0.3,
        distance: '0px'
    }, 200);
    sr.reveal('.sr-button', {
        duration: 1000,
        delay: 200
    });

// Back to Top Button
$(function() {
    var $backToTop = $('#backToTop');
    $(window).on('scroll', function() {
        if ($(this).scrollTop() > 300) {
            $backToTop.addClass('show');
        } else {
            $backToTop.removeClass('show');
        }
    });
    $backToTop.on('click', function(e) {
        e.preventDefault();
        $('html, body').stop().animate({
            scrollTop: 0
        }, 800, 'easeInOutExpo');
    });
});

// Reading Progress Bar
$(function() {
    var $progressBar = $('#readingProgressBar');
    if ($progressBar.length) {
        $(window).on('scroll', function() {
            var scrollTop = $(this).scrollTop();
            var docHeight = $(document).height() - $(window).height();
            var scrollPercent = (scrollTop / docHeight) * 100;
            $progressBar.css('width', scrollPercent + '%');
        });
    }
});

// Navbar Scrolled Effect
$(function() {
    var $navbar = $('.navbar');
    var lastScrollTop = 0;
    var scrollThreshold = 50;

    $(window).on('scroll', function() {
        var scrollTop = $(this).scrollTop();
        if (scrollTop > scrollThreshold) {
            $navbar.addClass('scrolled');
        } else {
            $navbar.removeClass('scrolled');
        }
        lastScrollTop = scrollTop;
    });
});

// Scroll Animations with Intersection Observer
$(function() {
    if ('IntersectionObserver' in window) {
        var $animateElements = $('.animate-on-scroll');
        if ($animateElements.length) {
            var observer = new IntersectionObserver(function(entries) {
                entries.forEach(function(entry) {
                    if (entry.isIntersecting) {
                        $(entry.target).addClass('animate-visible');
                        observer.unobserve(entry.target);
                    }
                });
            }, {
                threshold: 0.1,
                rootMargin: '0px 0px -50px 0px'
            });

            $animateElements.each(function() {
                observer.observe(this);
            });
        }
    } else {
        // Fallback: show all elements immediately
        $('.animate-on-scroll').addClass('animate-visible');
    }
});

// Toast Notifications
$(function() {
    // Show initial toast from server-side flash message
    var $initialToast = $('.toast-notification.show');
    if ($initialToast.length) {
        // Auto-dismiss after 5 seconds
        setTimeout(function() {
            dismissToast($initialToast);
        }, 5000);
    }

    // Close button handler
    $(document).on('click', '.toast-close', function() {
        var $toast = $(this).closest('.toast-notification');
        dismissToast($toast);
    });

    // Dismiss toast with animation
    window.dismissToast = function($toast) {
        $toast.removeClass('show').addClass('hiding');
        setTimeout(function() {
            $toast.remove();
        }, 300);
    };

    // Programmatic toast creation function
    window.showToast = function(message, type, duration) {
        type = type || 'info';
        duration = duration || 5000;

        var iconMap = {
            'success': 'fa-check-circle',
            'error': 'fa-times-circle',
            'info': 'fa-info-circle'
        };

        var $toast = $(
            '<div class="toast-notification toast-' + type + '" role="alert">' +
                '<div class="toast-icon"><i class="fa ' + (iconMap[type] || iconMap.info) + '"></i></div>' +
                '<div class="toast-message">' + message + '</div>' +
                '<button type="button" class="toast-close" aria-label="Cerrar"><span aria-hidden="true">&times;</span></button>' +
            '</div>'
        );

        var $container = $('#toastContainer');
        $container.append($toast);

        // Trigger animation
        setTimeout(function() {
            $toast.addClass('show');
        }, 10);

        // Auto-dismiss
        setTimeout(function() {
            dismissToast($toast);
        }, duration);
    };
});

// Dark Mode Toggle
$(function() {
    var $toggle = $('#darkModeToggle');
    var $body = $('body');

    // Check localStorage for saved preference
    var savedMode = localStorage.getItem('darkMode');
    if (savedMode === 'true') {
        $body.addClass('dark-mode');
    }

    $toggle.on('click', function(e) {
        e.preventDefault();
        $body.toggleClass('dark-mode');
        localStorage.setItem('darkMode', $body.hasClass('dark-mode'));
    });
});

// Search Autocomplete
$(function() {
    var $searchInput = $('#searchAutocomplete');
    var $resultsContainer = $('#searchAutocompleteResults');
    var searchTimeout;

    if ($searchInput.length) {
        $searchInput.on('input', function() {
            var query = $(this).val().trim();

            clearTimeout(searchTimeout);

            if (query.length < 2) {
                $resultsContainer.removeClass('active').empty();
                return;
            }

            searchTimeout = setTimeout(function() {
                $.ajax({
                    url: '/api/search',
                    data: { q: query },
                    dataType: 'json',
                    success: function(posts) {
                        if (posts.length === 0) {
                            $resultsContainer.removeClass('active').empty();
                            return;
                        }

                        var html = '';
                        posts.forEach(function(post) {
                            html += '<a href="/single_post/' + encodeURIComponent(post.slug) + '" class="search-autocomplete-item">';
                            html += '<div class="search-result-title">' + post.title + '</div>';
                            if (post.category) {
                                html += '<div class="search-result-category">' + post.category + '</div>';
                            }
                            html += '</a>';
                        });

                        $resultsContainer.html(html).addClass('active');
                    }
                });
            }, 300);
        });

        // Close autocomplete when clicking outside
        $(document).on('click', function(e) {
            if (!$(e.target).closest('.search-autocomplete-wrapper').length) {
                $resultsContainer.removeClass('active');
            }
        });

        // Close on Escape key
        $searchInput.on('keydown', function(e) {
            if (e.key === 'Escape') {
                $resultsContainer.removeClass('active');
            }
        });
    }
});

// Contact Form Real-time Validation
$(function() {
    var $contactForm = $('#contactForm');

    if ($contactForm.length) {
        // Subject selector
        $contactForm.on('click', '.subject-option', function() {
            $('.subject-option').removeClass('active');
            $(this).addClass('active');
            $('#subject').val($(this).data('subject'));
        });

        // Real-time validation on blur
        $contactForm.find('input[required], textarea[required]').on('blur', function() {
            var $field = $(this);
            var $group = $field.closest('.form-group');
            var value = $field.val().trim();

            $group.removeClass('has-error has-success');

            if (value.length === 0) {
                $group.addClass('has-error');
            } else if ($field.attr('type') === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                $group.addClass('has-error');
            } else {
                $group.addClass('has-success');
            }
        });

        // Subject option click handler
        $contactForm.on('click', '.subject-option', function() {
            $('.subject-option').removeClass('active');
            $(this).addClass('active');
            var subject = $(this).data('subject');
            $('#subject').val(subject);
            $('#subject').closest('.form-group').addClass('has-success');
        });
    }
});

// Favorites Toggle (AJAX)
$(function() {
    $(document).on('click', '.favorite-btn', function(e) {
        e.preventDefault();
        var $btn = $(this);
        var postId = $btn.data('post-id');
        var isFavorited = $btn.hasClass('active');

        $.ajax({
            url: '/api/favorites/' + postId,
            method: isFavorited ? 'DELETE' : 'POST',
            success: function(response) {
                if (response.success) {
                    $btn.toggleClass('active');
                    $btn.find('i').toggleClass('fa-star-o fa-star');
                    var count = $btn.find('.fav-count');
                    if (count.length) {
                        count.text(response.count);
                    }
                    if (!isFavorited) {
                        showToast('Post añadido a favoritos.', 'success', 3000);
                    } else {
                        showToast('Post eliminado de favoritos.', 'info', 3000);
                    }
                }
            },
            error: function() {
                showToast('Error al actualizar favoritos.', 'error', 3000);
            }
        });
    });

    // Remove favorite from profile
    $(document).on('click', '.remove-favorite-btn', function(e) {
        e.preventDefault();
        var $btn = $(this);
        var postId = $btn.data('post-id');
        var $item = $btn.closest('.favorite-post-item');

        $.ajax({
            url: '/api/favorites/' + postId,
            method: 'DELETE',
            success: function() {
                $item.fadeOut(300, function() {
                    $(this).remove();
                    showToast('Post eliminado de favoritos.', 'info', 3000);
                });
            }
        });
    });
});