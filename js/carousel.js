$(function(){
    if($('.gallery-wrapper').length){
        var galleryThumbs = new Swiper('.gallery-wrapper .content .gallery.thumb .swiper-container', {
            speed: 300,
            effect: 'slide',
            spaceBetween: 5,
            slidesToScroll: 1,
            grabCursor: false,
            simulateTouch: true,
            loop: false,
            swipe: true,
            swipeToSlide: true,
            watchSlidesVisibility: true,
            watchSlidesProgress: true,
            touchRatio: 0.1,
            navigation: {
                nextEl: '.gallery-wrapper .content .gallery.thumb .swiper-next-button',
                prevEl: '.gallery-wrapper .content .gallery.thumb .swiper-prev-button',
            },
            breakpoints: {
                320: {
                    slidesPerView: 3,
                    spaceBetween: 5,
                },
                414: {
                    slidesPerView: 3,
                    spaceBetween: 5
                },
                768: {
                    slidesPerView: 5,
                    spaceBetween: 5
                },
                1024: {
                    slidesPerView: 7,
                    spaceBetween: 5
                }
            },
			  on: {
				  init: function() { 
				  	let containerThumbWidth = $('.gallery-wrapper .content .gallery.thumb').outerWidth();
					let totalThumbWidth = 0;
					$('.gallery.thumb .swiper-container .swiper-wrapper .swiper-slide').each(function(){
						let thumbWidth = $(this).outerWidth();
						totalThumbWidth += thumbWidth
					});
					
					if(totalThumbWidth < containerThumbWidth){
						$('.gallery.thumb .swiper-next-button, .gallery.thumb .swiper-prev-button').addClass('hide');
					}else{
						$('.gallery.thumb .swiper-next-button, .gallery.thumb .swiper-prev-button').removeClass('hide');
					}
				}
			}
		});

        var galleryFull = new Swiper('.gallery-wrapper .content .gallery.full .swiper-container', {
            speed: 300,
            effect: 'slide',
            slidesPerView: 3,
            slidesToScroll: 1,
            spaceBetween: 5,
            centeredSlides: true,
            keyboard: {enabled: true,},
            grabCursor: false,
            simulateTouch: false,
            loop: true,
            swipe: true,
            swipeToSlide: true,
            touchRatio: 0.1,
        //  touchMoveStopPropagation: false,
		// 	longSwipes: false, // Включає контроль за довгими свайпами
        //  longSwipesMs: 50, // Максимальний час для довгого свайпу
        //  longSwipesRatio: 0.5, // Мінімальна частка свайпу для переходу до наступного слайда
            navigation: {
                nextEl: '.gallery-wrapper .content .gallery.full .swiper-next-button',
                prevEl: '.gallery-wrapper .content .gallery.full .swiper-prev-button',
            },
            thumbs: {
                swiper: galleryThumbs
            },
            on: {
                slideChangeTransitionStart: function () {
                    $('.gallery-wrapper .content .gallery.full .swiper-slide .overlay').removeClass('show');
                },
                slideChangeTransitionEnd: function () {
                    $('.gallery-wrapper .content .gallery.full .swiper-slide-active .overlay').addClass('show');
                }
            }
        });
    }
});

$(window).on("load", function() {
    setTimeout(function(){
        $('.loader').fadeOut();
    }, 1000);
});
