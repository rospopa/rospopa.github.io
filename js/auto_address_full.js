function initAutocomplete() {
    const input = document.getElementById("autocomplete");
    const suggestionsContainer = document.getElementById("suggestions");

    const autocomplete = new google.maps.places.Autocomplete(input, {
        componentRestrictions: { country: "us" },
        fields: ["address_components", "geometry", "name"],
        types: ["geocode"],
    });

    autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (!place.geometry) {
            window.alert("No details available for input: " + place.name);
            return;
        }

        let streetAddress = "";
        let city = "";
        let state = "";
        let zip = "";

        if (place.address_components) {
            for (const component of place.address_components) {
                const types = component.types;
                if (types.includes("street_number") || types.includes("route")) {
                    streetAddress += component.long_name + " ";
                } else if (types.includes("locality")) {
                    city = component.long_name;
                } else if (types.includes("administrative_area_level_1")) { // State
                    state = component.short_name; // Use short_name for state abbreviation
                } else if (types.includes("postal_code")) {
                    zip = component.long_name;
                }
            }
            streetAddress = streetAddress.trim();
        }

        // Construct the full address string
        let fullAddress = streetAddress;
        if (city) {
            fullAddress += ", " + city;
        }
        if (state) {
            fullAddress += ", " + state;
        }
        if (zip) {
            fullAddress += " " + zip;
        }


        input.value = fullAddress; // Set input field to the full address

        console.log("Full Address:", place.formatted_address);
        console.log("Extracted Street Address:", streetAddress);
        console.log("City:", city);
        console.log("State:", state);
        console.log("Zip:", zip);

        suggestionsContainer.innerHTML = ""; // Clear suggestions
    });

    }