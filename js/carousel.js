function singleGalleryCarousel () {
  if ($('.single-gallery-carousel-content-box').length && $('.single-gallery-carousel-thumbnail-box').length) {

    var $sync1 = $(".single-gallery-carousel-content-box"), // variable declaration
        $sync2 = $(".single-gallery-carousel-thumbnail-box"),
        flag = false,
        duration = 500;

        $sync1.owlCarousel({ //function for preview carousel
            items: 1,
            margin: 0,
            nav: false,
            dots: false
        })
        .on('changed.owl.carousel', function (e) {
            //var currentItem = e.item.index;
            //alert(currentItem);
            if (!flag) {
                flag = true;
                $sync2.trigger('to.owl.carousel', [e.item.index, duration, true]);
                flag = false;
            }
        });

        $('.single-gallery-carousel-content-box').magnificPopup({ //function for magnific popup
            type: 'image',
            delegate: '.owl-item:not(.cloned) a',
            closeOnContentClick: false,
            removalDelay: 500,
            callbacks: {
                beforeOpen: function() {
                     this.st.image.markup = this.st.image.markup.replace('mfp-figure', 'mfp-figure mfp-with-anim');
                     this.st.mainClass = this.st.el.attr('data-effect');
                }
            },
            tLoading: 'Loading image #%curr%...',
            mainClass: 'mfp-zoom-in mfp-img-mobile',
            gallery: {
                enabled: true,
                navigateByImgClick: true,
                preload: [0,1]
            },
            zoom: {
                enabled: true,
                duration: 300
            },
            image: {
                tError: '<a href="%url%">The image #%curr%</a> could not be loaded.',
                titleSrc: function(item) {
                    return item.el.attr('title') + '<small></small>';
                }
            }
        });
    
        $sync2.owlCarousel({ //function for thumbnails carousel
            margin: 1,
            items: 7,
            nav: true,
            dots: false,
            navText:false,
            center: false,
            responsive: {
                0:{
                    items:2,
                    autoWidth: false
                },
                400:{
                    items:3,
                    autoWidth: false
                },
                768:{
                    items:4,
                    autoWidth: false
                }
            },
        })
        .on('click', '.owl-item', function () {
            $sync1.trigger('to.owl.carousel', [$(this).index(), duration, true]);
        })
        .on('changed.owl.carousel', function (e) {
            if (!flag) {
                flag = true;    
                $sync1.trigger('to.owl.carousel', [e.item.index, duration, true]);
                flag = false;
            }
        });
    };
}
singleGalleryCarousel (); //FUNCTION CALLED HERE