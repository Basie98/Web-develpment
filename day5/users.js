console.log("users.js is connected!");
const loadButton = document.querySelector("#load-users");
const filterInput = document.querySelector("#filter-input");
const statusMessage = document.querySelector("#status");
const usersList = document.querySelector("#users-list");

let users = [];

async function loadUsers() {
    loadButton.disabled = true;
    statusMessage.textContent = "Loading users...";

    try {
        const response = await fetch(
    "https://jsonplaceholder.typicode.com/users"
        );

        if (!response.ok) {
            throw new Error("Failed to load users.");
        }

        users = await response.json();

        renderUsers(users);

        statusMessage.textContent = `Successfully loaded ${users.length} users.`;
    } catch (error) {
        statusMessage.textContent =
            "Error loading users. Please try again.";

        console.error("Error:", error);
    } finally {
        loadButton.disabled = false;
    }
}

function renderUsers(list) {
    usersList.replaceChildren();

    if (list.length === 0) {
        statusMessage.textContent = "No users match your filter.";
        return;
    }

    list.forEach((user) => {
        const li = document.createElement("li");

        const name = document.createElement("h2");
        name.textContent = user.name;

        const email = document.createElement("p");
        email.textContent = `Email: ${user.email}`;

        const city = document.createElement("p");
        city.textContent = `City: ${user.address.city}`;

        const company = document.createElement("p");
        company.textContent = `Company: ${user.company.name}`;

        li.append(name, email, city, company);
        usersList.appendChild(li);
    });
}

loadButton.addEventListener("click", loadUsers);

filterInput.addEventListener("input", () => {
    const searchText = filterInput.value.toLowerCase().trim();

    const filteredUsers = users.filter((user) =>
        user.name.toLowerCase().includes(searchText)
    );

    renderUsers(filteredUsers);

    if (filteredUsers.length > 0) {
        statusMessage.textContent =
            `Showing ${filteredUsers.length} user(s).`;
    }
});

